/**
 * Creates the single owner account.
 *
 * Reads `OWNER_EMAIL` and `OWNER_PASSWORD` from the environment and never
 * from a file, and never logs the password. It is idempotent by owner
 * email: running it twice leaves one owner and promotes an existing
 * customer row to owner rather than creating a second one. An existing
 * password is never overwritten, so running the script cannot lock the
 * owner out of their own shop.
 *
 * The password hash is produced by Better Auth itself, so hashing stays
 * inside the auth library where it belongs.
 *
 * Run it with: `npm run seed:owner`
 */
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/db";
import { users } from "@/features/auth/infrastructure/auth-schema";
import { auth } from "@/features/auth/infrastructure/auth";
import { env } from "@/core/env";

/** The email shown when the owner row is created from scratch. */
function defaultOwnerName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Reads the owner facts. Takes nothing, returns the email and the password. Throws loudly when unset. */
function ownerCredentials(): { email: string; password: string } {
  const values = env();
  const email = values.OWNER_EMAIL;
  const password = values.OWNER_PASSWORD;
  if (email === undefined || email.length === 0) {
    throw new Error("OWNER_EMAIL is not set. Add the owner email to the environment before running this script.");
  }
  if (password === undefined || password.length === 0) {
    throw new Error("OWNER_PASSWORD is not set. Add the owner password to the environment before running this script.");
  }
  return { email, password };
}

/** Runs the script. Takes nothing, returns nothing. Sets the process exit code on failure. */
async function main(): Promise<void> {
  const { email, password } = ownerCredentials();
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const found = existing[0];

  if (found === undefined) {
    // Sign up through Better Auth so the password hash comes from the auth
    // library. The name doubles as the display name, because signup refuses
    // a buyer without one; the role is promoted to owner right after.
    const name = defaultOwnerName(email);
    await auth.api.signUpEmail({ body: { email, password, name, displayName: name } });
    console.log(`Created the owner account for ${email}.`);
  } else {
    console.log(`Owner account for ${email} already existed, so its password was left as it is.`);
  }

  const promoted = await db
    .update(users)
    .set({ role: "owner", updatedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, role: users.role, displayName: users.displayName });
  console.log("Owner row:", promoted);
  console.log("Delete OWNER_PASSWORD from Vercel now if this ran in production.");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Owner creation failed.", error);
    process.exit(1);
  });