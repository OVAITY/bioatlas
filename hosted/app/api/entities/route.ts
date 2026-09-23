import { NextRequest, NextResponse } from "next/server";
import { databaseUnavailable, handleApiError } from "@/lib/api-response";
import { listPublishedByType } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unavailable = databaseUnavailable();
  if (unavailable) return unavailable;
  try {
    const type = request.nextUrl.searchParams.get("type");
    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }
    return NextResponse.json({ entities: await listPublishedByType(type) });
  } catch (error) {
    return handleApiError(error);
  }
}
