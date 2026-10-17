/**
 * Theme cookie helpers. The choice lives in the `theme` cookie for one
 * year (`light` or `dark`, absent means follow the system). Takes cookie
 * values, returns the resolved theme name.
 */
export const THEME_COOKIE = "theme";
export const THEME_MAX_AGE = 31536000;

export type ThemeChoice = "light" | "dark" | "system";

/** Resolves the cookie value. Takes the raw cookie, returns light, dark, or system. */
export function resolveThemeChoice(raw: string | undefined): ThemeChoice {
  if (raw === "light" || raw === "dark") return raw;
  return "system";
}
