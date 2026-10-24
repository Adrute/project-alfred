import { loginSchema } from "@/domain/auth";
import { apiError, checkOrigin, readJson, withApiAuth } from "@/lib/api-security";
import { authenticate, csrfToken, login, logout, sessionCookie } from "@/services/auth-service";

export const dynamic = "force-dynamic";
export const GET = withApiAuth(async (request: Request) => {
  const { user, token } = await authenticate(request);
  return Response.json({ user, csrfToken: csrfToken(token) });
});
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = loginSchema.parse(await readJson(request, 8 * 1024));
    const { user, token } = await login(input.username, input.password);
    return Response.json({ user, csrfToken: csrfToken(token) }, { headers: { "set-cookie": sessionCookie(token), "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export const DELETE = withApiAuth(async (request: Request) => {
  const { token } = await authenticate(request);
  await logout(token);
  return Response.json({ ok: true }, { headers: { "set-cookie": sessionCookie("", true) } });
});
