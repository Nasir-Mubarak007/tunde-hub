/**
 * Viewer facts for gated reads.
 * Presentation resolves the Better Auth session and passes plain facts here.
 * The application layer never touches session cookies or headers.
 */
import type { UserRole } from "@/features/auth/domain/userRole";

/** A signed in viewer, or null for an anonymous visitor. */
export type Viewer = {
  readonly userId: string;
  readonly role: UserRole;
} | null;
