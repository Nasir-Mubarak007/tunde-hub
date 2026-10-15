/**
 * Roles for signed up people.
 * One owner manages the shop. Customers browse, view detail and claim.
 */

/** Every role. Takes nothing, used as the source of the union below. */
export const USER_ROLES = ["owner", "customer"] as const;

/** A user role. Either owner or customer. */
export type UserRole = (typeof USER_ROLES)[number];

/** Checks a raw string. Takes the candidate, returns true only for a known role. */
export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/** Tells whether a role may open the admin panel. Takes the role, returns the answer. */
export function canAccessAdminPanel(role: UserRole): boolean {
  return role === "owner";
}
