import { withApiAuth } from "@/lib/api-security";
import { beginChatGptSignIn } from "@/services/chatgpt-auth-service";
import { requestToken } from "@/services/auth-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function handlePOST(request: Request) {
  try {
    const input = z.object({ newRegistration: z.boolean().optional() }).parse(await request.json().catch(() => ({})));
    return Response.json({ url: await beginChatGptSignIn(requestToken(request)!, input.newRegistration ?? false) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar la conexión." },
      { status: 400 },
    );
  }
}

export const POST = withApiAuth(handlePOST, "admin");
