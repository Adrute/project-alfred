import { withApiAuth } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getConversation, handleChat } from "@/services/chat-service";
import { chatPageContextSchema } from "@/domain/chat";

const inputSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().trim().min(1).max(4_000),
  pageContext: chatPageContextSchema.optional(),
});

export const dynamic = "force-dynamic";
async function handleGET(request: Request) {
  const id = new URL(request.url).searchParams.get("conversationId") ?? undefined;
  return NextResponse.json(await getConversation(id), { headers: { "cache-control": "no-store" } });
}
async function handlePOST(request: Request) {
  try {
    return NextResponse.json(await handleChat(inputSchema.parse(await request.json())));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo procesar el mensaje." }, { status: 400 });
  }
}

export const GET = withApiAuth(handleGET, "user");
export const POST = withApiAuth(handlePOST, "user");
