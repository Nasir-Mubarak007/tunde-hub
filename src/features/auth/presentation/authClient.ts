/**
 * The browser side auth client.
 * Calls the Better Auth API routes, so every signup and sign in passes the
 * hourly cap in the route handler. Direct server calls would skip it.
 * The inferred fields mirror the server user fields, so the display name
 * travels typed on signup.
 */
"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

/** The client the auth forms call. Takes nothing, shared across the shop. */
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: ["owner", "customer"], required: false },
        displayName: { type: "string", required: false },
      },
    }),
  ],
});
