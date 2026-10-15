/**
 * The sign in prompt shown to an anonymous visitor on a detail page.
 * The next parameter carries this exact page, so sign in returns here.
 */
import Link from "next/link";

/** Renders the prompt. Takes the current path, returns the panel element. */
export function SignInPrompt({ nextPath }: { readonly nextPath: string }) {
  return (
    <section className="gate">
      <h2 className="gate__title">Sign in to see the full account</h2>
      <p className="gate__text">
        Cards are public on purpose. The screenshots, the full facts and the claim button are for signed in buyers, and
        claiming takes one tap once you are in.
      </p>
      <Link href={`/sign-in?next=${encodeURIComponent(nextPath)}`} className="button button--solid">
        Sign in to continue
      </Link>
      <p className="gate__aside">New here? Sign up on the same page.</p>
    </section>
  );
}
