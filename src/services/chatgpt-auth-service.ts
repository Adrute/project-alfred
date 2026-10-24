import { createHash, createPublicKey, randomBytes, randomUUID, verify } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { z } from "zod";
import { loadConfig } from "@/config/env";
import { requireCloudAi } from "@/lib/cloud-policy";

const AUTHORIZATION_ENDPOINT = "https://auth.openai.com/api/accounts/authorize";
const TOKEN_ENDPOINT = "https://auth.openai.com/api/accounts/oauth/token";
const OPENID_CONFIGURATION_ENDPOINT = "https://auth.openai.com/.well-known/openid-configuration";
const MODELS_ENDPOINT = "https://api.openai.com/v1/models";
const RESOURCE = "https://api.openai.com/v1";
const REQUIRED_SCOPE = "chatgpt.tokens.use.direct";
const REQUESTED_SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";

const pendingSchema = z.object({
  state: z.string().min(32),
  nonce: z.string().min(32),
  verifier: z.string().min(43),
  redirectUri: z.string().url(),
  requestedClientId: z.string().min(1),
  createdAt: z.string().datetime(),
});

const registrationSchema = z.object({
  subject: z.string().min(1),
  clientId: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenType: z.string().default("Bearer"),
  expiresAt: z.string().datetime().optional(),
  earliestRefreshAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).default([]),
  selectedModel: z.string().min(1).optional(),
});

const authStoreSchema = z.object({
  version: z.literal(1).default(1),
  hostId: z.string().startsWith("urn:uuid:"),
  aliasSecret: z.string().min(32),
  registration: registrationSchema.nullable().default(null),
  pending: pendingSchema.nullable().default(null),
});

const transferableCredentialsSchema = z.object({
  version: z.literal(1),
  kind: z.literal("alfred-chatgpt-credentials"),
  registration: registrationSchema,
});

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  id_token: z.string().min(1),
  token_type: z.string().default("Bearer"),
  expires_in: z.number().int().positive(),
  earliest_refresh_at: z.union([z.number(), z.string()]).optional(),
  scope: z.string().default(""),
});

const openIdConfigurationSchema = z.object({
  issuer: z.string().url(),
  jwks_uri: z.string().url(),
  revocation_endpoint: z.string().url().optional(),
});

const jwksSchema = z.object({
  keys: z.array(z.object({
    kid: z.string(),
    kty: z.string(),
    alg: z.string().optional(),
    use: z.string().optional(),
  }).passthrough()),
});

const planModelListSchema = z.object({
  models: z.array(z.object({
    slug: z.string().min(1),
    display_name: z.string().optional(),
    visibility: z.string().optional(),
  })).default([]),
});

const apiModelListSchema = z.object({
  data: z.array(z.object({
    id: z.string().min(1),
    owned_by: z.string().optional(),
  })).default([]),
});

type AuthStore = z.infer<typeof authStoreSchema>;
type Registration = z.infer<typeof registrationSchema>;

export interface ChatGptConnectionStatus {
  cloudEnabled: boolean;
  canSignInHere: boolean;
  connected: boolean;
  planEnabled: boolean;
  account: { email?: string; name?: string; picture?: string } | null;
  model: string | null;
  detail: string;
}

export interface ChatGptModelOption {
  id: string;
  label: string;
}

function authPaths() {
  const config = loadConfig();
  const directory = path.resolve(config.DATA_DIRECTORY, "auth");
  return {
    directory,
    file: path.join(directory, "chatgpt.json"),
    lock: path.join(directory, "chatgpt.lock"),
    recoveryLock: path.join(directory, "chatgpt.lock.recovery"),
  };
}

async function withAuthStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const { directory, lock, recoveryLock } = authPaths();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  let handle;
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    try {
      await stat(recoveryLock);
      await delay(50);
      continue;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    try {
      handle = await open(lock, "wx", 0o600);
      break;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      let recoveryHandle;
      try {
        recoveryHandle = await open(recoveryLock, "wx", 0o600);
        try {
          const metadata = await stat(lock);
          if (Date.now() - metadata.mtimeMs > 45_000) await unlink(lock);
        } catch (lockError) {
          if (!(lockError instanceof Error) || !("code" in lockError) || lockError.code !== "ENOENT") throw lockError;
        }
      } catch (recoveryError) {
        if (!(recoveryError instanceof Error) || !("code" in recoveryError) || recoveryError.code !== "EEXIST") throw recoveryError;
      } finally {
        if (recoveryHandle) {
          await recoveryHandle.close();
          await unlink(recoveryLock).catch(() => undefined);
        }
      }
      await delay(50);
    }
  }
  if (!handle) throw new Error("El almacén de ChatGPT está ocupado. Inténtalo de nuevo.");
  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lock).catch(() => undefined);
  }
}

export async function clearOrphanedChatGptLocks() {
  const { lock, recoveryLock } = authPaths();
  for (const file of [lock, recoveryLock]) {
    try {
      await unlink(file);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
  }
}

async function persistStore(store: AuthStore) {
  const parsed = authStoreSchema.parse(store);
  const { directory, file } = authPaths();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `chatgpt-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, file);
  if (process.platform !== "win32") await chmod(file, 0o600);
}

async function readStore(): Promise<AuthStore> {
  const { file } = authPaths();
  try {
    return authStoreSchema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    const created = authStoreSchema.parse({
      hostId: `urn:uuid:${randomUUID()}`,
      aliasSecret: randomBytes(32).toString("base64url"),
    });
    await persistStore(created);
    return created;
  }
}

function base64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function callbackUri() {
  return `http://127.0.0.1:${loadConfig().PORT}/auth/callback`;
}

function canAuthorizeOnThisHost() {
  const config = loadConfig();
  return config.APP_ORIGIN === `http://127.0.0.1:${config.PORT}`;
}

export async function beginChatGptSignIn() {
  requireCloudAi();
  if (!canAuthorizeOnThisHost()) {
    throw new Error("El acceso a ChatGPT debe autorizarse en Alfred ejecutado localmente y transferirse después a esta instancia.");
  }
  const store = await readStore();
  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  const verifier = randomUrlSafe(48);
  const redirectUri = callbackUri();
  const requestedClientId = store.registration?.clientId ?? "dynamic_agent_client";
  store.pending = pendingSchema.parse({
    state,
    nonce,
    verifier,
    redirectUri,
    requestedClientId,
    createdAt: new Date().toISOString(),
  });
  await persistStore(store);

  const parameters = new URLSearchParams({
    client_id: requestedClientId,
    ext_agent_host_id: store.hostId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: REQUESTED_SCOPES,
    resource: RESOURCE,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: base64Url(createHash("sha256").update(verifier).digest()),
  });
  if (requestedClientId === "dynamic_agent_client") parameters.set("agent_name_hint", "Alfred");
  else {
    if (store.registration?.idToken) parameters.set("id_token_hint", store.registration.idToken);
    if (store.registration?.email) parameters.set("login_hint", store.registration.email);
  }
  return `${AUTHORIZATION_ENDPOINT}?${parameters.toString()}`;
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

async function validateIdToken(idToken: string, clientId: string, nonce: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("El token de identidad de ChatGPT no es válido.");
  const header = z.object({ alg: z.literal("RS256"), kid: z.string().min(1) }).parse(decodeJwtPart<unknown>(parts[0]));
  const configurationResponse = await fetch(OPENID_CONFIGURATION_ENDPOINT, { cache: "no-store" });
  if (!configurationResponse.ok) throw new Error("No se pudo validar la identidad con OpenAI.");
  const configuration = openIdConfigurationSchema.parse(await configurationResponse.json());
  const jwksResponse = await fetch(configuration.jwks_uri, { cache: "no-store" });
  if (!jwksResponse.ok) throw new Error("No se pudieron obtener las claves de identidad de OpenAI.");
  const key = jwksSchema.parse(await jwksResponse.json()).keys.find((candidate) => candidate.kid === header.kid);
  if (!key) throw new Error("OpenAI no publicó la clave usada para firmar la sesión.");
  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    createPublicKey({ key, format: "jwk" }),
    Buffer.from(parts[2], "base64url"),
  );
  if (!validSignature) throw new Error("La firma de identidad de ChatGPT no es válida.");
  const payload = z.object({
    iss: z.string(),
    sub: z.string().min(1),
    aud: z.union([z.string(), z.array(z.string())]),
    exp: z.number().int(),
    nonce: z.string(),
    email: z.string().email().optional(),
    name: z.string().optional(),
    picture: z.string().url().optional(),
  }).passthrough().parse(decodeJwtPart<unknown>(parts[1]));
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== configuration.issuer || !audiences.includes(clientId)) throw new Error("La identidad devuelta no pertenece a esta conexión.");
  if (payload.exp * 1_000 <= Date.now() || payload.nonce !== nonce) throw new Error("La autorización de ChatGPT ha caducado o no coincide con la solicitud.");
  return payload;
}

function parseEarliestRefresh(value: number | string | undefined) {
  if (value === undefined) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return new Date(numeric > 10_000_000_000 ? numeric : numeric * 1_000).toISOString();
}

function supportsTextResponses(modelId: string) {
  return /^gpt-[\w.-]+$/i.test(modelId)
    && !/(?:audio|image|realtime|transcrib|tts|search|embed|moderation)/i.test(modelId);
}

async function fetchAvailableModels(accessToken: string): Promise<ChatGptModelOption[]> {
  const response = await fetch(MODELS_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenAI no pudo devolver el catálogo de modelos (${response.status}).`);
  const body = await response.json() as unknown;
  const planModels = planModelListSchema.safeParse(body);
  const models = planModels.success
    ? planModels.data.models.filter((model) => !model.visibility || model.visibility === "list").map((model) => ({ id: model.slug, label: model.display_name ?? model.slug }))
    : apiModelListSchema.parse(body).data.map((model) => ({ id: model.id, label: model.id }));
  return [...new Map(models.filter((model) => supportsTextResponses(model.id)).map((model) => [model.id, model])).values()]
    .sort((left, right) => left.label.localeCompare(right.label));
}

async function selectModel(accessToken: string) {
  const preferred = loadConfig().CHATGPT_MODEL;
  try {
    const models = await fetchAvailableModels(accessToken);
    return models.find((model) => model.id === preferred)?.id ?? models[0]?.id ?? preferred;
  } catch {
    return preferred;
  }
}

export async function completeChatGptSignIn(parameters: URLSearchParams) {
  requireCloudAi();
  const store = await readStore();
  const pending = store.pending;
  if (!pending) throw new Error("No hay ningún inicio de sesión pendiente.");
  store.pending = null;
  await persistStore(store);
  if (Date.now() - Date.parse(pending.createdAt) > 10 * 60_000) throw new Error("El inicio de sesión ha caducado. Inténtalo de nuevo.");
  if (parameters.get("state") !== pending.state) throw new Error("La respuesta de ChatGPT no coincide con la solicitud iniciada.");
  if (parameters.get("error")) throw new Error("Se canceló o rechazó el acceso a ChatGPT.");
  const code = z.string().min(1).parse(parameters.get("code"));
  const callbackClientId = parameters.get("client_id");
  const clientId = pending.requestedClientId === "dynamic_agent_client" ? callbackClientId : pending.requestedClientId;
  if (!clientId || clientId === "dynamic_agent_client") throw new Error("ChatGPT no devolvió el identificador registrado de Alfred.");
  if (callbackClientId && pending.requestedClientId !== "dynamic_agent_client" && callbackClientId !== pending.requestedClientId) {
    throw new Error("ChatGPT devolvió una conexión diferente de la autorizada.");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: pending.verifier,
      redirect_uri: pending.redirectUri,
      resource: RESOURCE,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenAI rechazó el intercambio OAuth (${response.status}).`);
  const tokens = tokenResponseSchema.parse(await response.json());
  const identity = await validateIdToken(tokens.id_token, clientId, pending.nonce);
  if (store.registration?.subject && pending.requestedClientId !== "dynamic_agent_client" && store.registration.subject !== identity.sub) {
    throw new Error("La cuenta de ChatGPT no coincide con la conexión guardada.");
  }
  const scopes = tokens.scope.split(/\s+/).filter(Boolean);
  const selectedModel = await selectModel(tokens.access_token);
  store.registration = registrationSchema.parse({
    subject: identity.sub,
    clientId,
    email: identity.email,
    name: identity.name,
    picture: identity.picture,
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1_000).toISOString(),
    earliestRefreshAt: parseEarliestRefresh(tokens.earliest_refresh_at),
    scopes,
    selectedModel,
  });
  await persistStore(store);
  return getChatGptStatus();
}

let refreshInFlight: Promise<Registration | null> | null = null;

async function refreshRegistration(store: AuthStore): Promise<Registration | null> {
  const registration = store.registration;
  if (!registration?.accessToken || !registration.expiresAt) return null;
  if (Date.parse(registration.expiresAt) - Date.now() > 60_000) return registration;
  return withAuthStoreLock(async () => {
    const latest = await readStore();
    const current = latest.registration;
    if (!current?.accessToken || !current.expiresAt) return null;
    if (Date.parse(current.expiresAt) - Date.now() > 60_000) return current;
    if (!current.refreshToken) return null;
    if (current.earliestRefreshAt && Date.parse(current.earliestRefreshAt) > Date.now() && Date.parse(current.expiresAt) > Date.now()) return current;
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: current.clientId,
        refresh_token: current.refreshToken,
        resource: RESOURCE,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        latest.registration = registrationSchema.parse({ ...current, accessToken: undefined, refreshToken: undefined, idToken: undefined, scopes: [] });
        await persistStore(latest);
      }
      return null;
    }
    const tokens = tokenResponseSchema.parse(await response.json());
    const refreshed = registrationSchema.parse({
      ...current,
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? current.refreshToken,
      tokenType: tokens.token_type,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1_000).toISOString(),
      earliestRefreshAt: parseEarliestRefresh(tokens.earliest_refresh_at),
      scopes: tokens.scope.split(/\s+/).filter(Boolean),
    });
    latest.registration = refreshed;
    await persistStore(latest);
    return refreshed;
  });
}

export async function getChatGptSession() {
  if (!loadConfig().CLOUD_AI_ENABLED) return null;
  const store = await readStore();
  if (!refreshInFlight) refreshInFlight = refreshRegistration(store).finally(() => { refreshInFlight = null; });
  let registration: Registration | null;
  try {
    registration = await refreshInFlight;
  } catch {
    return null;
  }
  if (!registration?.accessToken || !registration.scopes.includes(REQUIRED_SCOPE)) return null;
  return { accessToken: registration.accessToken, model: registration.selectedModel ?? loadConfig().CHATGPT_MODEL };
}

export async function getChatGptStatus(): Promise<ChatGptConnectionStatus> {
  const config = loadConfig();
  const canSignInHere = canAuthorizeOnThisHost();
  if (!config.CLOUD_AI_ENABLED) return { cloudEnabled: false, canSignInHere, connected: false, planEnabled: false, account: null, model: null, detail: "ChatGPT está desactivado mediante la configuración de emergencia." };
  const store = await readStore();
  const registration = store.registration;
  const planEnabled = Boolean(registration?.accessToken && registration.scopes.includes(REQUIRED_SCOPE));
  return {
    cloudEnabled: true,
    canSignInHere,
    connected: Boolean(registration?.accessToken),
    planEnabled,
    account: registration ? { email: registration.email, name: registration.name, picture: registration.picture } : null,
    model: planEnabled ? registration?.selectedModel ?? loadConfig().CHATGPT_MODEL : null,
    detail: planEnabled
      ? "ChatGPT está conectado. Los nombres del alumnado se sustituyen localmente antes de cada petición."
      : registration?.accessToken
        ? "La cuenta está conectada, pero no autorizó el uso del plan de ChatGPT."
        : canSignInHere
          ? "Conecta ChatGPT para activar el razonamiento con lenguaje natural."
          : "Esta instancia necesita importar una sesión autorizada previamente en Alfred local.",
  };
}

async function writeProtectedJson(targetPath: string, value: unknown) {
  const resolved = path.resolve(targetPath);
  const directory = path.dirname(resolved);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  if (process.platform !== "win32") await chmod(resolved, 0o600);
}

export async function exportChatGptCredentials(targetPath: string) {
  requireCloudAi();
  const registration = (await readStore()).registration;
  if (!registration?.refreshToken) throw new Error("No hay una sesión de ChatGPT transferible.");
  await writeProtectedJson(targetPath, transferableCredentialsSchema.parse({
    version: 1,
    kind: "alfred-chatgpt-credentials",
    registration,
  }));
}

export async function importChatGptCredentials(sourcePath: string) {
  requireCloudAi();
  const resolved = path.resolve(sourcePath);
  const metadata = await stat(resolved);
  if (!metadata.isFile() || metadata.size > 64 * 1024) throw new Error("El archivo de credenciales no es válido.");
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    throw new Error("El archivo de credenciales debe tener permisos 0600.");
  }
  if (process.platform !== "win32" && typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new Error("El archivo de credenciales debe pertenecer al usuario que ejecuta Alfred.");
  }
  const transferred = transferableCredentialsSchema.parse(JSON.parse(await readFile(resolved, "utf8")));
  await withAuthStoreLock(async () => {
    const store = await readStore();
    store.registration = transferred.registration;
    store.pending = null;
    await persistStore(store);
  });
}

export async function getChatGptModelCatalog() {
  const session = await getChatGptSession();
  if (!session) return { connected: false, defaultModel: null, models: [] as ChatGptModelOption[] };
  try {
    const models = await fetchAvailableModels(session.accessToken);
    if (!models.some((model) => model.id === session.model)) models.unshift({ id: session.model, label: session.model });
    return { connected: true, defaultModel: session.model, models };
  } catch {
    return { connected: true, defaultModel: session.model, models: [{ id: session.model, label: session.model }] };
  }
}

export async function getAliasSecret() {
  return (await readStore()).aliasSecret;
}

export async function disconnectChatGpt() {
  requireCloudAi();
  const store = await readStore();
  const registration = store.registration;
  let remoteRevocationConfirmed = true;
  if (registration?.refreshToken) {
    try {
      const configuration = openIdConfigurationSchema.parse(await (await fetch(OPENID_CONFIGURATION_ENDPOINT, { cache: "no-store" })).json());
      if (configuration.revocation_endpoint) {
        const response = await fetch(configuration.revocation_endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: registration.refreshToken, token_type_hint: "refresh_token", client_id: registration.clientId }),
          cache: "no-store",
        });
        remoteRevocationConfirmed = response.ok;
      }
    } catch {
      remoteRevocationConfirmed = false;
    }
  }
  if (registration) {
    store.registration = registrationSchema.parse({
      subject: registration.subject,
      clientId: registration.clientId,
      email: registration.email,
      name: registration.name,
      picture: registration.picture,
      selectedModel: registration.selectedModel,
      scopes: [],
    });
  }
  store.pending = null;
  await persistStore(store);
  return { remoteRevocationConfirmed };
}
