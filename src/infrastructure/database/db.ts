import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@/features/auth/infrastructure/auth-schema";
import * as listingsSchema from "@/features/listings/infrastructure/drizzle/schema";

export const schema = {
  ...authSchema,
  ...listingsSchema,
};

export type Schema = typeof schema;

const globalForDb = globalThis as unknown as { client?: postgres.Sql };

const client = globalForDb.client ?? postgres(process.env.DATABASE_URL!, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle({ client, schema });
