/**
 * The sign out button in the shop header.
 * Signs out through the auth client, then lands home with a fresh anonymous
 * session. A quiet button, so it sits beside the buyer name without shouting.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "./authClient";

/** Renders the button. Takes nothing, returns the sign out control. */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /** Signs out. Takes nothing, returns nothing. */
  async function signOut(): Promise<void> {
    if (busy) {
      return;
    }
    setBusy(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className="button button--quiet button--small" onClick={signOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
