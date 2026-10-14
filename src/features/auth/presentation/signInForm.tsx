/**
 * The sign in and create account form.
 * One card with two modes, matching the detail page prompt that says sign up
 * happens on the same page. Both modes call the auth API routes through the
 * client, so the hourly cap counts every attempt. Success lands on the
 * return path the caller passed in.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "./authClient";

/** The two modes the card flips between. Sign in is the default. */
export type SignInMode = "signin" | "signup";

/** What the card needs. The landing path plus the starting mode. */
export interface SignInFormProps {
  readonly next: string;
  readonly initialMode: SignInMode;
}

/** Turns an auth failure into words a buyer can act on. Takes the status plus the raw message, returns the copy. */
function friendlyError(status: number | undefined, raw: string | undefined): string {
  const message = raw ?? "";
  if (status === 429 || message.toLowerCase().includes("too many")) {
    return "Too many tries this hour. Wait a little, then try again.";
  }
  if (message.includes("A display name is required.")) {
    return message;
  }
  if (status === 422 || message.toLowerCase().includes("already exists") || message.toLowerCase().includes("already")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (status === 401 || message.toLowerCase().includes("invalid email or password")) {
    return "That email and password did not match. Try again.";
  }
  if (message.toLowerCase().includes("invalid email")) {
    return "That email does not look right. Check it and try again.";
  }
  if (message.length > 0) {
    return message;
  }
  return "Something did not work. Try again.";
}

/** Renders the form card. Takes the landing path plus the starting mode, returns the card element. */
export function SignInForm({ next, initialMode }: SignInFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<SignInMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  /** Flips the card mode. Takes the mode, clears any shown error. */
  function flip(nextMode: SignInMode): void {
    setMode(nextMode);
    setProblem(null);
  }

  /** Submits the form. Takes the submit event, returns nothing. */
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setProblem(null);
    const attempt = signup
      ? await authClient.signUp.email({ email, password, name: displayName, displayName })
      : await authClient.signIn.email({ email, password });
    if (attempt.error !== null) {
      setProblem(friendlyError(attempt.error.status, attempt.error.message ?? undefined));
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-tabs" role="group" aria-label="Sign in or create an account">
        <button
          type="button"
          className="auth-tabs__tab"
          aria-pressed={!signup}
          onClick={() => flip("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className="auth-tabs__tab"
          aria-pressed={signup}
          onClick={() => flip("signup")}
        >
          Create account
        </button>
      </div>

      <h2 id="auth-title" className="auth-card__title">
        {signup ? "Create your buyer account" : "Welcome back"}
      </h2>
      <p className="auth-card__lead">
        {signup
          ? "One account holds your claims and opens every full detail page."
          : "Sign in to see full details, screenshots and your claim button."}
      </p>

      {problem === null ? null : (
        <p className="auth-error" role="alert">
          {problem}
        </p>
      )}

      <form onSubmit={submit}>
        {signup ? (
          <div className="field">
            <label className="field__label" htmlFor="auth-display-name">
              Display name
            </label>
            <input
              id="auth-display-name"
              name="displayName"
              type="text"
              className="field__control"
              autoComplete="name"
              maxLength={80}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <p className="field__hint">Shown to the seller in the WhatsApp handoff.</p>
          </div>
        ) : null}

        <div className="field">
          <label className="field__label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            className="field__control"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            className="field__control"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {signup ? <p className="field__hint">At least 8 characters.</p> : null}
        </div>

        <button type="submit" className="button button--solid button--wide" disabled={busy}>
          {busy ? (signup ? "Creating your account…" : "Signing you in…") : signup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="auth-fine">
        {signup
          ? "Already have an account? Flip to sign in above."
          : "New here? Flip to create account above. It takes half a minute."}
      </p>
    </section>
  );
}
