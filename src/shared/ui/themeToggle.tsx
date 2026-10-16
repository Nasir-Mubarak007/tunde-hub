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
      <button type="button" className="button button--quiet button--small" aria-label="Switch theme">
        Theme
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
      className="button button--quiet button--small"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
