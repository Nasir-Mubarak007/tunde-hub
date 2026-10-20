"use client";

/**
 * Theme toggle. Client only at the interactive edge: the blocking script
 * in the layout paints the theme, this button only flips the cookie and
 * the class. Takes nothing, returns a small quiet button.
 */
import { useEffect, useState } from "react";
import { THEME_COOKIE, THEME_MAX_AGE } from "./theme";

function applyTheme(next: "light" | "dark"): void {
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.style.colorScheme = next;
  document.cookie = `${THEME_COOKIE}=${next}; max-age=${THEME_MAX_AGE}; path=/; SameSite=Lax`;
}

function resolveCurrent(): "light" | "dark" {
  const match = document.cookie.match(/(?:^|; )theme=(light|dark)/);
  if (match) return match[1] === "dark" ? "dark" : "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * The two theme marks, drawn as strokes so they take the text colour of
 * whatever they sit on. Both are always in the markup and the stylesheet
 * picks one from the `dark` class, so the server render and the client
 * render are identical and the no flash script decides the first paint.
 */
function ThemeIcon() {
  return (
    <>
      <svg
        className="theme-toggle__icon theme-toggle__icon--moon"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8Z" />
      </svg>
      <svg
        className="theme-toggle__icon theme-toggle__icon--sun"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    </>
  );
}

export function ThemeToggle() {
  // Null until hydration: the server has no window, so the true theme is
  // known only on the client. Server and client render the same fallback.
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    // Mount-only read matching the documented next-themes mounted pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(resolveCurrent());
  }, []);

  if (theme === null) {
    return (
      <button type="button" className="button button--quiet theme-toggle" aria-label="Switch theme">
        <ThemeIcon />
      </button>
    );
  }

  function onToggle(): void {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className="button button--quiet theme-toggle"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={theme === "dark"}
    >
      <ThemeIcon />
    </button>
  );
}
