import { NextResponse } from "next/server";
import { databaseUnavailable, handleApiError } from "@/lib/api-response";
import { getVideosPayload } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = databaseUnavailable();
  if (unavailable) return unavailable;
  try {
    return NextResponse.json(await getVideosPayload());
  } catch (error) {
    return handleApiError(error);
  }
}
