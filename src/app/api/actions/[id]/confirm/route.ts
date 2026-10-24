import { withApiAuth, apiError } from "@/lib/api-security";
import { NextResponse } from "next/server";
import { confirmAction } from "@/services/action-service";

async function handlePOST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await confirmAction(id));
  } catch (error) {
    return apiError(error);
  }
}

export const POST = withApiAuth(handlePOST, "user");
