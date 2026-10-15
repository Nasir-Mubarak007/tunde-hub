import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/infrastructure/database/db";
import * as authSchema from "@/features/auth/infrastructure/auth-schema";
import { RATE_LIMIT_MAX_ATTEMPTS } from "@/features/listings/domain/rateLimit";
import { authRateLimitStorage } from "./rateLimitStorage";

/**
 * Refuses a customer signup with no display name.
 * The database check `users_role_display_name_check` is the real rule; this
 * hook turns it into a message the sign up form can show instead of a
 * database error. Owners are exempt, since the owner script creates the one
 * owner row without a display name.
 */
async function requireDisplayNameForCustomer(user: Record<string, unknown>): Promise<void> {
  if (user.role === "owner") {
    return;
  }
  const displayName = user.displayName;
  if (typeof displayName !== "string" || displayName.trim().length === 0) {
    throw new APIError("BAD_REQUEST", { message: "A display name is required." });
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      role: {
        type: ["owner", "customer"],
        required: true,
        defaultValue: "customer",
        input: false,
        returned: true,
      },
      displayName: {
        type: "string",
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          await requireDisplayNameForCustomer(user);
        },
      },
    },
  },
  rateLimit: {
    // The cap is the same five attempts an hour the claim path uses, so a
    // visitor cannot dodge it by signing up instead of claiming. Enabled
    // everywhere, not only in production, so the rule is testable locally.
    enabled: true,
    customStorage: authRateLimitStorage,
    customRules: {
      "/sign-up/*": { window: 3600, max: RATE_LIMIT_MAX_ATTEMPTS },
    },
  },
  plugins: [nextCookies()],
});