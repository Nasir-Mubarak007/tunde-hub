/**
 * The owner panel overview strip.
 * Five plain count links, one per panel bucket, so you see live rows plus
 * pending claims plus sold rows plus the total at a glance. The active
 * bucket reads as current for assistive tech. Server rendered, no client
 * code, counts arrive as plain numbers.
 */
import Link from "next/link";
import type { AdminCounts, AdminStatusFilter } from "../domain/repositories";
import { ADMIN_STATUS_FILTERS } from "../domain/repositories";

/** Words shown per bucket. Takes nothing, keyed by the stored filter value. */
const FILTER_LABELS: Record<AdminStatusFilter, string> = {
  all: "All",
  available: "Live",
  pending: "Pending",
  sold: "Sold",
  deleted: "Deleted",
};

/** What the strip needs. Counts plus the active bucket. */
export interface AdminOverviewProps {
  readonly counts: AdminCounts;
  readonly active: AdminStatusFilter;
}

/** Renders the strip. Takes counts plus the active bucket, returns the nav element. */
export function AdminOverview({ counts, active }: AdminOverviewProps) {
  return (
    <nav aria-label="Listing buckets" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>
      {ADMIN_STATUS_FILTERS.map((filter) => {
        const count = counts[filter === "all" ? "total" : filter];
        const current = filter === active;
        return (
          <Link
            key={filter}
            href={filter === "all" ? "/admin" : `/admin?status=${filter}`}
            aria-current={current ? "page" : undefined}
            className={current ? "button button--solid button--small" : "button button--quiet button--small"}
          >
            {FILTER_LABELS[filter]} · {count}
          </Link>
        );
      })}
    </nav>
  );
}
