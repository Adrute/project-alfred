import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-security";
import { completeChatGptSignIn } from "@/services/chatgpt-auth-service";
import { requestToken } from "@/services/auth-service";
import { loadConfig } from "@/config/env";

export const dynamic = "force-dynamic";

async function handleGET(request: Request) {
  const target = new URL("/", loadConfig().APP_ORIGIN);
  try {
    await completeChatGptSignIn(new URL(request.url).searchParams, requestToken(request)!);
    target.searchParams.set("chatgpt", "connected");
  } catch (error) {
    target.searchParams.set("chatgpt", "error");
    target.searchParams.set("reason", error instanceof Error ? error.message : "No se pudo completar la conexión.");
  }
  return NextResponse.redirect(target);
}

export const GET = withApiAuth(handleGET, "admin");
