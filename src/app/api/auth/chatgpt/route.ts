import { NextResponse } from "next/server";
import { disconnectChatGpt, getChatGptStatus } from "@/services/chatgpt-auth-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getChatGptStatus(), { headers: { "cache-control": "no-store" } });
}

export async function DELETE() {
  const result = await disconnectChatGpt();
  return NextResponse.json({
    ...(await getChatGptStatus()),
    warning: result.remoteRevocationConfirmed ? null : "La sesión local se cerró, pero no se pudo confirmar la revocación remota.",
  }, { headers: { "cache-control": "no-store" } });
}
