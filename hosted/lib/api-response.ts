import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "./db";

export const dynamicDb = {
  runtime: "nodejs" as const,
  dynamic: "force-dynamic" as const,
};

export function databaseUnavailable() {
  if (isDatabaseConfigured()) return null;
  return NextResponse.json(
    { error: "DATABASE_URL is not configured" },
    { status: 503 },
  );
}

export function handleApiError(error: unknown) {
  console.error(error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("DATABASE_URL") ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}
