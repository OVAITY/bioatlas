import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function postgresOptions(url: string) {
  const local = /localhost|127\.0\.0\.1/.test(url);
  return {
    max: process.env.VERCEL ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? undefined : ("require" as const),
  };
}

export function getSql() {
  if (!globalForDb.sql) {
    const url = getDatabaseUrl();
    globalForDb.sql = postgres(url, postgresOptions(url));
  }
  return globalForDb.sql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
