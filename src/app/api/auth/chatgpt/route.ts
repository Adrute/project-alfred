import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { disconnectChatGpt, getChatGptStatus } from "@/services/chatgpt-auth-service";

export const dynamic = "force-dynamic";

async function handleGET() {
  return NextResponse.json(await getChatGptStatus(), { headers: { "cache-control": "no-store" } });
}

async function handleDELETE() {
  const result = await disconnectChatGpt();
  return NextResponse.json({
    ...(await getChatGptStatus()),
    warning: result.remoteRevocationConfirmed ? null : "La sesión local se cerró, pero no se pudo confirmar la revocación remota.",
  }, { headers: { "cache-control": "no-store" } });
}

export const GET = withApiAuth(handleGET, "admin");
export const DELETE = withApiAuth(handleDELETE, "admin");
