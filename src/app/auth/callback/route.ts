import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-security";
import { completeChatGptSignIn } from "@/services/chatgpt-auth-service";

export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  const target = new URL("/", request.url);
  try {
    await completeChatGptSignIn(new URL(request.url).searchParams);
    target.searchParams.set("chatgpt", "connected");
  } catch (error) {
    target.searchParams.set("chatgpt", "error");
    target.searchParams.set("reason", error instanceof Error ? error.message : "No se pudo completar la conexión.");
  }
  return NextResponse.redirect(target);
}

export const GET = withApiAuth(handleGET, "admin");
