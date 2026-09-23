import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-response";
import { getStructureAtlas, getStructureCatalogue } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [collections, atlas] = await Promise.all([getStructureCatalogue(), Promise.resolve(getStructureAtlas())]);
    return NextResponse.json({ collections, ...atlas });
  } catch (error) {
    return handleApiError(error);
  }
}
