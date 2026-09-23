import { NextResponse } from "next/server";
import { databaseUnavailable, handleApiError } from "@/lib/api-response";
import { getNeighbors, resolveEntityRef } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const unavailable = databaseUnavailable();
  if (unavailable) return unavailable;
  try {
    const { slug } = await context.params;
    const entity = await resolveEntityRef(slug);
    if (!entity || entity.status !== "published" || entity.visibility !== "public") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const graph = await getNeighbors(slug, 1);
    return NextResponse.json({ entity, neighbors: graph.neighbors });
  } catch (error) {
    return handleApiError(error);
  }
}
