/**
 * The user entity.
 * Password handling stays inside Better Auth. This module owns
 * the role plus display name rules: customers show a name,
 * the script created owner needs none.
 */
import type { Result } from "@/core/result";
import { err, ok } from "@/core/result";
import type { UserRole } from "./userRole";
import { isUserRole } from "./userRole";

/** A signed up person. The id shape follows the Better Auth text id. */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly displayName: string | null;
  readonly createdAt: Date;
}

/** Plain input for creating a user entity. */
export interface CreateUserInput {
  readonly id: string;
  readonly email: string;
  readonly role: string;
  readonly displayName: string | null;
}

/** Why user values are invalid. Returned as values, never thrown. */
export type UserValidationIssue =
  | "id-required"
  | "email-required"
  | "role-unknown"
  | "display-name-required";

/** Creates a user entity. Takes plain input plus the clock, returns the entity or the issues. */
export function createUser(
  input: CreateUserInput,
  now: Date,
): Result<User, readonly UserValidationIssue[]> {
  const issues: UserValidationIssue[] = [];
  if (input.id.trim().length === 0) {
    issues.push("id-required");
  }
  if (input.email.trim().length === 0) {
    issues.push("email-required");
  }
  if (!isUserRole(input.role)) {
    issues.push("role-unknown");
  } else if (input.role === "customer" && (input.displayName === null || input.displayName.trim().length === 0)) {
    issues.push("display-name-required");
  }
  if (issues.length > 0) {
    return err(issues);
  }
  return ok({
    id: input.id,
    email: input.email.trim(),
    role: input.role as UserRole,
    displayName: input.displayName,
    createdAt: now,
  });
}

/** Tells whether a user is the owner. Takes the user, returns the answer. */
export function isOwner(user: Pick<User, "role">): boolean {
  return user.role === "owner";
}
