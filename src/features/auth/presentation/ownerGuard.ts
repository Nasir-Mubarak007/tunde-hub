/**
 * The owner gate for the private panel routes.
 * Anonymous visitors go to sign in with a return path, signed in customers
 * go home. Only the owner role reaches the caller. The panel pages that
 * call this land with the listing management remainder of this feature.
 */
import { redirect } from "next/navigation";
import { getSessionViewer } from "../infrastructure/sessionViewer";
import type { SessionViewer } from "../infrastructure/sessionViewer";

/** Requires the owner. Takes the guarded path, returns the owner viewer or redirects. */
export async function requireOwnerViewer(guardedPath: string): Promise<SessionViewer> {
  const viewer = await getSessionViewer();
  if (viewer === null) {
    redirect(`/sign-in?next=${encodeURIComponent(guardedPath)}`);
  }
  if (viewer.role !== "owner") {
    redirect("/");
  }
  return viewer;
}
