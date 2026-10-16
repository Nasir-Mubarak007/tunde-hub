/**
 * The owner panel list.
 * A server list of every listing including soft deleted ones. Each row names
 * the holder when somebody holds the listing, links to the edit page, and
 * carries small forms for delete, restore, and purge. All writes run through
 * server actions that check the owner first.
 */
import Link from "next/link";
import type { AdminListingDto } from "../application/adminListingDto";
import {
  purgeListingFormAction,
  restoreListingFormAction,
  softDeleteListingFormAction,
} from "./adminListingActions";

/** What the list needs. The page passes the admin rows. */
export interface AdminListProps {
  readonly items: readonly AdminListingDto[];
}

/** One day in milliseconds. The unit pending age divides by. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Words for a pending row. Takes the pending since date plus now, returns e.g. pending for 3 days. */
function pendingAge(pendingSince: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - pendingSince.getTime()) / DAY_MS));
  return days === 0 ? "Pending since today" : `Pending for ${days} ${days === 1 ? "day" : "days"}`;
}

/** Words for a sold row. Takes the sold at date, returns e.g. Sold on 12 Oct 2026. */
function soldOn(soldAt: Date): string {
  return `Sold on ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(soldAt)}`;
}

/** Renders the rows. Takes the items, returns the table element. */
export function AdminList({ items }: AdminListProps) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No listings yet</p>
        <p className="empty__text">Add your first listing and it will show here and on the shop.</p>
        <Link className="button button--solid" href="/admin/listings/new">
          Add a listing
        </Link>
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Your listings">
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }} scope="col">
              Title
            </th>
            <th style={{ textAlign: "left", padding: "8px" }} scope="col">
              Facts
            </th>
            <th style={{ textAlign: "left", padding: "8px" }} scope="col">
              State
            </th>
            <th style={{ textAlign: "left", padding: "8px" }} scope="col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const now = new Date();
            return (
            <tr key={item.id} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "8px" }}>
                <strong>{item.title}</strong>
                <br />
                <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
                  {item.platformLabel} · {item.priceDisplay} · {item.followerCount} followers · {item.ageDisplay}
                </span>
                <br />
                <span style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                  {item.imageCount} photos · /{item.slug}
                </span>
                {item.holder === null || item.status !== "pending" ? null : (
                  <span style={{ display: "block", fontSize: 13 }}>
                    Held by {item.holder.displayName ?? item.holder.email}
                    {item.pendingSince === null ? "" : ` · ${pendingAge(item.pendingSince, now)}`}
                  </span>
                )}
                {item.status === "sold" && item.soldAt !== null ? (
                  <span style={{ display: "block", fontSize: 13 }}>{soldOn(item.soldAt)}</span>
                ) : null}
              </td>
              <td style={{ padding: "8px", fontSize: 13, color: "var(--ink-muted)" }}>
                {item.status}
                {item.isDeleted ? " · deleted" : ""}
              </td>
              <td style={{ padding: "8px" }}>
                <span className="badge">{item.isDeleted ? "deleted" : item.status}</span>
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link className="button button--quiet button--small" href={`/admin/listings/${item.id}/edit`}>
                    Edit
                  </Link>
                  {item.isDeleted ? (
                    <form action={restoreListingFormAction}>
                      <input type="hidden" name="listingId" value={item.id} />
                      <button className="button button--quiet button--small" type="submit">
                        Restore
                      </button>
                    </form>
                  ) : (
                    <form action={softDeleteListingFormAction}>
                      <input type="hidden" name="listingId" value={item.id} />
                      <button className="button button--quiet button--small" type="submit">
                        Delete
                      </button>
                    </form>
                  )}
                  <form action={purgeListingFormAction}>
                    <input type="hidden" name="listingId" value={item.id} />
                    <button className="button button--quiet button--small" type="submit" title="Removes the listing for good">
                      Purge
                    </button>
                  </form>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
