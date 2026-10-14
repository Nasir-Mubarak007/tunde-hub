/**
 * Session facts for the storefront.
 * Presentation resolves the Better Auth session and passes plain values to
 * the use cases. Nothing below this module knows about cookies or headers.
 */
import { headers } from "next/headers";
import { connection } from "next/server";
import { auth } from "./auth";
import { isUserRole } from "../domain/userRole";
import type { UserRole } from "../domain/userRole";

/** A signed in person as the storefront needs them. Null means anonymous. */
export interface SessionViewer {
  readonly userId: string;
  readonly role: UserRole;
  readonly displayName: string | null;
  readonly email: string;
}

/** Reads the session once per request. Takes nothing, returns the viewer or null. */
export async function getSessionViewer(): Promise<SessionViewer | null> {
  await connection();
  try {
    return await readViewer();
  } catch (error) {
    // Cards are public, so a broken session read must not hide the shop.
    // It downgrades the page to anonymous and leaves the cause in the log.
    console.error("Session read failed, serving the page as anonymous.", error);
    return null;
  }
}

/** Reads the session from Better Auth. Takes nothing, returns the viewer or null. Throws on a broken session. */
async function readViewer(): Promise<SessionViewer | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) {
    return null;
  }
  const user = session.user as {
    readonly id: string;
    readonly email: string;
    readonly role?: unknown;
    readonly displayName?: unknown;
  };
  return {
    userId: user.id,
    role: typeof user.role === "string" && isUserRole(user.role) ? user.role : "customer",
    displayName: typeof user.displayName === "string" ? user.displayName : null,
    email: user.email,
  };
}
