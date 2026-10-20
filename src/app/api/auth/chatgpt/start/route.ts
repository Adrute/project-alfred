import { NextResponse } from "next/server";
import { beginChatGptSignIn } from "@/services/chatgpt-auth-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return NextResponse.redirect(await beginChatGptSignIn());
  } catch (error) {
    const target = new URL("/", request.url);
    target.searchParams.set("chatgpt", "error");
    target.searchParams.set("reason", error instanceof Error ? error.message : "No se pudo iniciar la conexión.");
    return NextResponse.redirect(target);
  }
}
