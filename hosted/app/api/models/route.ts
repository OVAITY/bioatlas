import { NextResponse } from "next/server";
import { databaseUnavailable, handleApiError } from "@/lib/api-response";
import { hasBiorodeoCatalogue } from "@/lib/biorodeo-catalogue";
import { bioRodeoAttribution, getModelCatalogue, getRunProviders } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasBiorodeoCatalogue()) {
    const unavailable = databaseUnavailable();
    if (unavailable) return unavailable;
  }
  try {
    const [models, providers] = await Promise.all([getModelCatalogue(), getRunProviders()]);
    return NextResponse.json({
      models,
      providers,
      source: bioRodeoAttribution(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
