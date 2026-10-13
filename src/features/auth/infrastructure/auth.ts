import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/infrastructure/database/db";
import * as authSchema from "@/features/auth/infrastructure/auth-schema";

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
        fieldName: "display_name",
      },
    },
  },
  plugins: [nextCookies()],
});
