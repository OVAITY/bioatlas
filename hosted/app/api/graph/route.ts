import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-response";
import { getKnowledgeGraph, getNeighbors } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from");
    const depth = Number(request.nextUrl.searchParams.get("depth") || "1");
    if (!from) {
      return NextResponse.json(await getKnowledgeGraph());
    }
    const graph = await getNeighbors(from, depth);
    if (!graph.center) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(graph);
  } catch (error) {
    return handleApiError(error);
  }
}
