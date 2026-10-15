import { z } from "zod";

/**
 * Environment variables schema.
 * Validates env at startup per AGENTS.md and fails loud.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().min(1, "DIRECT_DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars").optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  OWNER_EMAIL: z.string().email().optional(),
  OWNER_PASSWORD: z.string().min(1).optional(),
  UPLOADTHING_TOKEN: z.string().min(1).optional(),
  SELLER_WHATSAPP_NUMBER: z
    .string()
    .regex(/^\d{7,15}$/, "SELLER_WHATSAPP_NUMBER must be digits with a country code and no plus")
    .optional(),
  CRON_SECRET: z.string().min(1).optional(),
  HASH_SECRET: z.string().min(32, "HASH_SECRET must be at least 32 chars").optional(),
  NEON_BRANCH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | undefined;

export function env(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
