/**
 * The panel status filter value.
 * Reads the raw status query value and returns a known bucket, defaulting
 * to all for missing or bogus values, so no URL ever breaks the panel.
 * Plain module, never a server action, so pages import it freely.
 */
import { isAdminStatusFilter } from "../domain/repositories";
import type { AdminStatusFilter } from "../domain/repositories";

/** Reads one raw filter value. Takes the raw query value, returns a known bucket or all. */
export function parseAdminStatusFilter(raw: string | string[] | undefined): AdminStatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && isAdminStatusFilter(value) ? value : "all";
}
