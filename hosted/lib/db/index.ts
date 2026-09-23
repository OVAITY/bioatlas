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

export function getSql() {
  if (!globalForDb.sql) {
    globalForDb.sql = postgres(getDatabaseUrl(), { max: 10 });
  }
  return globalForDb.sql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
