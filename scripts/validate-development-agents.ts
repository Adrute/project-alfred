import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

const providerModelSchema = z.object({
  model: z.string().min(1),
  reasoning: z.string().min(1).optional(),
  effort: z.string().min(1).optional(),
}).strict();

const profileSchema = z.object({
  purpose: z.string().min(1),
  codex: providerModelSchema.extend({ reasoning: z.string().min(1) }),
  claude: providerModelSchema.extend({ effort: z.string().min(1) }),
}).strict();

const manifestSchema = z.object({
  version: z.literal(1),
  orchestrator: z.string().min(1),
  maxParallelAgents: z.number().int().min(1).max(4),
  profiles: z.object({
    economy: profileSchema,
    balanced: profileSchema,
    deep: profileSchema,
  }).strict(),
  agents: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    profile: z.enum(["economy", "balanced", "deep"]),
    writeScope: z.enum(["coordination", "plans-only", "backend", "frontend", "persistence", "tests-only", "read-only", "docs-only"]),
    role: z.string().startsWith(".agents/roles/").endsWith(".md"),
  }).strict()).min(1),
}).strict();

const featureManifestSchema = z.object({
  version: z.literal(1),
  features: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    doc: z.string().startsWith("docs/features/").endsWith(".md"),
    keywords: z.array(z.string().min(1)).min(1),
    entryPoints: z.array(z.string().min(1)).min(1),
  }).strict()).min(1),
}).strict();

async function textFile(root: string, relativePath: string, failures: string[]) {
  try {
    return await readFile(path.resolve(root, relativePath), "utf8");
  } catch {
    failures.push(`Falta ${relativePath}.`);
    return "";
  }
}

function includesLine(content: string, expression: RegExp, file: string, label: string, failures: string[]) {
  if (!expression.test(content)) failures.push(`${file} no declara ${label}.`);
}

export async function validateDevelopmentAgents(root = process.cwd()) {
  const failures: string[] = [];
  const rawManifest = await textFile(root, ".agents/manifest.json", failures);
  if (!rawManifest) return failures;

  const parsed = manifestSchema.safeParse(JSON.parse(rawManifest) as unknown);
  if (!parsed.success) return [...failures, `Manifest inválido: ${z.prettifyError(parsed.error)}`];
  const manifest = parsed.data;
  const ids = manifest.agents.map((agent) => agent.id);
  if (new Set(ids).size !== ids.length) failures.push("Hay identificadores de agente duplicados.");
  if (!ids.includes(manifest.orchestrator)) failures.push("El orquestador no existe en el catálogo.");

  for (const agent of manifest.agents) {
    const role = await textFile(root, agent.role, failures);
    for (const heading of ["## Mission", "## Owns", "## Does not own", "## Required output"]) {
      if (!role.includes(heading)) failures.push(`${agent.role} no contiene ${heading}.`);
    }

    const profile = manifest.profiles[agent.profile];
    const codexFile = `.codex/agents/${agent.id}.toml`;
    const codex = await textFile(root, codexFile, failures);
    includesLine(codex, new RegExp(`^name = "${agent.id}"$`, "m"), codexFile, "el nombre canónico", failures);
    includesLine(codex, new RegExp(`^model = "${profile.codex.model.replaceAll(".", "\\.")}"$`, "m"), codexFile, "el modelo del perfil", failures);
    includesLine(codex, new RegExp(`^model_reasoning_effort = "${profile.codex.reasoning}"$`, "m"), codexFile, "el esfuerzo del perfil", failures);
    if (!codex.includes(agent.role)) failures.push(`${codexFile} no referencia ${agent.role}.`);

    const claudeFile = `.claude/agents/${agent.id}.md`;
    const claude = await textFile(root, claudeFile, failures);
    includesLine(claude, new RegExp(`^name: ${agent.id}$`, "m"), claudeFile, "el nombre canónico", failures);
    includesLine(claude, new RegExp(`^model: ${profile.claude.model}$`, "m"), claudeFile, "el modelo del perfil", failures);
    includesLine(claude, new RegExp(`^effort: ${profile.claude.effort}$`, "m"), claudeFile, "el esfuerzo del perfil", failures);
    if (!claude.includes(agent.role)) failures.push(`${claudeFile} no referencia ${agent.role}.`);
  }

  const codexConfig = await textFile(root, ".codex/config.toml", failures);
  includesLine(codexConfig, new RegExp(`^max_concurrent_threads_per_session = ${manifest.maxParallelAgents}$`, "m"), ".codex/config.toml", "el límite de concurrencia", failures);
  const agentsInstructions = await textFile(root, "AGENTS.md", failures);
  const claudeInstructions = await textFile(root, "CLAUDE.md", failures);
  if (!agentsInstructions.includes(".agents/manifest.json")) failures.push("AGENTS.md no enlaza el catálogo neutral.");
  if (!claudeInstructions.includes("@AGENTS.md")) failures.push("CLAUDE.md no importa las instrucciones canónicas.");

  const changelog = await textFile(root, "CHANGELOG.md", failures);
  if (!changelog.includes("## [Unreleased]")) failures.push("CHANGELOG.md no contiene la sección Unreleased.");

  const featureIndex = await textFile(root, "docs/features/README.md", failures);
  const rawFeatureManifest = await textFile(root, "docs/features/manifest.json", failures);
  if (rawFeatureManifest) {
    let featureManifest: z.infer<typeof featureManifestSchema> | undefined;
    try {
      const parsedFeatures = featureManifestSchema.safeParse(JSON.parse(rawFeatureManifest) as unknown);
      if (!parsedFeatures.success) {
        failures.push(`Catálogo funcional inválido: ${z.prettifyError(parsedFeatures.error)}`);
      } else {
        featureManifest = parsedFeatures.data;
      }
    } catch (error) {
      failures.push(`Catálogo funcional no es JSON válido: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (featureManifest) {
      const featureIds = featureManifest.features.map((feature) => feature.id);
      if (new Set(featureIds).size !== featureIds.length) failures.push("Hay identificadores funcionales duplicados.");
      for (const feature of featureManifest.features) {
        const featureDoc = await textFile(root, feature.doc, failures);
        for (const heading of ["## Alcance", "## Fuente de verdad e invariantes", "## Puntos de entrada", "## Checklist de cambio"]) {
          if (!featureDoc.includes(heading)) failures.push(`${feature.doc} no contiene ${heading}.`);
        }
        if (!featureIndex.includes(path.basename(feature.doc))) {
          failures.push(`docs/features/README.md no enlaza ${feature.doc}.`);
        }
        for (const entryPoint of feature.entryPoints) {
          await textFile(root, entryPoint, failures);
        }
      }
    }
  }
  return failures;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const failures = await validateDevelopmentAgents();
  if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.info("Equipo de desarrollo validado: agentes, contexto funcional y adaptadores sincronizados.");
  }
}
