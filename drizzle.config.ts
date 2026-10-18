import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/features/auth/infrastructure/auth-schema.ts",
    "./src/features/listings/infrastructure/drizzle/schema.ts",
    "./src/features/observability/infrastructure/drizzle/schema.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
