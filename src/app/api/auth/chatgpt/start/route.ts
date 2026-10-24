import { withApiAuth } from "@/lib/api-security";
import { beginChatGptSignIn } from "@/services/chatgpt-auth-service";

export const dynamic = "force-dynamic";

async function handlePOST() {
  try {
    return Response.json({ url: await beginChatGptSignIn() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar la conexión." },
      { status: 400 },
    );
  }
}

export const POST = withApiAuth(handlePOST, "admin");
