import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-response";
import { getAtlasPayload } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAtlasPayload());
  } catch (error) {
    return handleApiError(error);
  }
}
