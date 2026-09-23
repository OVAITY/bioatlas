import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-response";
import { searchEntities } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";
    return NextResponse.json({ results: await searchEntities(q) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { q?: string; embedding?: number[] };
    return NextResponse.json({
      results: await searchEntities(body.q || "", body.embedding),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
