/**
 * The owner panel list.
 * A table of every listing including soft deleted ones. Each row names the
 * holder when somebody holds the listing, links to the edit page, and
 * carries the moves that row's state allows plus delete, restore and purge.
 *
 * This is client code on purpose: the lifecycle buttons disable while a move
 * runs and keep focus, and the bulk bar needs one selection shared across
 * rows. Every write still runs through a server action that checks the owner
 * first, so the client never decides anything.
 */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { AdminListingDto } from "../application/adminListingDto";
import type { ListingStatus } from "../domain/listingStatus";
import type { AdminStatusFilter } from "../domain/repositories";
import {
  bulkConfirmSoldFormAction,
  bulkReleaseFormAction,
  confirmSoldFormAction,
  markSoldDirectFormAction,
  purgeListingFormAction,
  releaseListingFormAction,
  reopenSoldFormAction,
  restoreListingFormAction,
  softDeleteListingFormAction,
} from "./adminListingActions";
import type { SaleActionResult } from "./adminListingActions";

/** What the list needs. The page passes the admin rows and the active bucket. */
export interface AdminListProps {
  readonly items: readonly AdminListingDto[];
  readonly status: AdminStatusFilter;
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

/** The name shown for a holder. Takes the row, returns the holder name or the Buyer fallback. */
function holderName(item: AdminListingDto): string {
  return item.holder?.displayName ?? "Buyer";
}

/** What one bucket says when it is empty. Takes the bucket, returns the title plus the words under it. */
function emptyCopy(status: AdminStatusFilter): { readonly title: string; readonly text: string } {
  switch (status) {
    case "pending":
      return { title: "No pending claims", text: "Nobody is holding an account right now." };
    case "sold":
      return { title: "No recent sales", text: "Accounts you sell show here for seven days." };
    case "available":
      return { title: "No available listings", text: "Add a listing and it shows here and on the shop." };
    case "deleted":
      return { title: "Nothing deleted", text: "Listings you delete wait here so you can restore them." };
    case "all":
      return { title: "No listings yet", text: "Add your first listing and it will show here and on the shop." };
    default:
      return { title: "No listings yet", text: "Add your first listing and it will show here and on the shop." };
  }
}

/** The lifecycle buttons one row's state allows. Takes the state and the shared runner, returns the buttons. */
function SaleButtons({
  status,
  busy,
  onRun,
}: {
  readonly status: ListingStatus;
  readonly busy: boolean;
  readonly onRun: (move: (id: number) => Promise<SaleActionResult>) => void;
}) {
  switch (status) {
    case "pending":
      return (
        <>
          <button
            className="button button--quiet button--small"
            type="button"
            aria-disabled={busy}
            onClick={() => onRun(confirmSoldFormAction)}
          >
            Sold
          </button>
          <button
            className="button button--quiet button--small"
            type="button"
            aria-disabled={busy}
            onClick={() => onRun(releaseListingFormAction)}
          >
            Release
          </button>
        </>
      );
    case "available":
      return (
        <button
          className="button button--quiet button--small"
          type="button"
          aria-disabled={busy}
          onClick={() => onRun(markSoldDirectFormAction)}
        >
          Mark sold
        </button>
      );
    case "sold":
      return (
        <button
          className="button button--quiet button--small"
          type="button"
          aria-disabled={busy}
          onClick={() => onRun(reopenSoldFormAction)}
        >
          Reopen
        </button>
      );
    default:
      return null;
  }
}

/** The bulk bar for the pending rows on this page. Takes the ids, the selection and the runner, returns the bar. */
function BulkBar({
  pendingIds,
  selected,
  busy,
  onToggle,
  onRun,
}: {
  readonly pendingIds: readonly number[];
  readonly selected: ReadonlySet<number>;
  readonly busy: boolean;
  readonly onToggle: (id: number) => void;
  readonly onRun: (
    ids: readonly number[],
    move: (ids: readonly number[]) => Promise<{ readonly message: string }>,
  ) => void;
}) {
  const chosen = pendingIds.filter((id) => selected.has(id));
  const allTicked = chosen.length === pendingIds.length && pendingIds.length > 0;

  return (
    <div className="panel panel--notice">
      <p className="panel__title">Work on several claims at once</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
          <input
            type="checkbox"
            checked={allTicked}
            aria-disabled={busy}
            onChange={() => {
              for (const id of pendingIds) {
                onToggle(id);
              }
            }}
          />
          {allTicked ? "Clear selection" : "Select all pending on this page"}
        </label>
        <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
          {chosen.length} of {pendingIds.length} selected
        </span>
        <button
          className="button button--quiet button--small"
          type="button"
          aria-disabled={busy}
          onClick={() => onRun(chosen, bulkConfirmSoldFormAction)}
        >
          Confirm selected
        </button>
        <button
          className="button button--quiet button--small"
          type="button"
          aria-disabled={busy}
          onClick={() => onRun(chosen, bulkReleaseFormAction)}
        >
          Release selected
        </button>
      </div>
    </div>
  );
}

/** Renders the rows. Takes the items plus the active bucket, returns the table and the bulk bar. */
export function AdminList({ items, status }: AdminListProps) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [running, startTransition] = useTransition();
  const messageRef = useRef<HTMLParagraphElement | null>(null);
  const now = new Date();

  /**
   * Keeps the keyboard where the owner left it. A move revalidates the page,
   * so the button that was pressed is gone by the time the refreshed rows
   * arrive and the browser drops focus to the document. Whenever that has
   * happened, the result itself takes focus, which is also what a screen
   * reader announces. The effect watches the rows as well as the message,
   * because the refreshed rows land in their own render, after the message.
   */
  useEffect(() => {
    if (message !== null && document.activeElement === document.body) {
      messageRef.current?.focus();
    }
  }, [message, items]);

  /** Adds or removes one row from the selection. Takes the id, returns nothing. */
  function toggle(id: number): void {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  /**
   * Runs one move while the table is busy, then clears the selection and
   * shows the words the move returned. Takes the move and the listing id,
   * returns nothing.
   */
  function runOnRow(move: (id: number) => Promise<SaleActionResult>, listingId: number): void {
    if (running) {
      return;
    }
    startTransition(async () => {
      const result = await move(listingId);
      setSelected(new Set());
      setMessage(result.message);
    });
  }

  /**
   * Runs one bulk move over the ticked rows. Takes the ids and the move, returns nothing.
   * An empty selection is passed to the action on purpose, so the panel prints
   * the one clear sentence written for that press instead of swallowing it.
   */
  function runOnSelected(listingIds: readonly number[], move: (ids: readonly number[]) => Promise<{ readonly message: string }>): void {
    if (running) {
      return;
    }
    startTransition(async () => {
      setMessage((await move(listingIds)).message);
    });
  }

  const result = message === null ? null : (
    <p className="panel__text" role="status" tabIndex={-1} ref={messageRef}>
      {message}
    </p>
  );

  if (items.length === 0) {
    const copy = emptyCopy(status);
    return (
      <div className="empty">
        {result}
        <p className="empty__title">{copy.title}</p>
        <p className="empty__text">{copy.text}</p>
        {status === "all" ? (
          <Link className="button button--solid" href="/admin/listings/new">
            Add a listing
          </Link>
        ) : (
          <Link className="button button--quiet" href="/admin">
            See all listings
          </Link>
        )}
      </div>
    );
  }

  const pendingIds = items.filter((item) => item.status === "pending" && !item.isDeleted).map((item) => item.id);

  return (
    <>
      {result}
      {pendingIds.length === 0 ? null : (
        <BulkBar
          pendingIds={pendingIds}
          selected={selected}
          busy={running}
          onToggle={toggle}
          onRun={runOnSelected}
        />
      )}
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
              const selectable = item.status === "pending" && !item.isDeleted;
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
                    {item.status === "pending" ? (
                      <span style={{ display: "block", fontSize: 13 }}>
                        Held by {holderName(item)}
                        {item.pendingSince === null ? "" : ` · ${pendingAge(item.pendingSince, now)}`}
                      </span>
                    ) : null}
                    {item.status === "sold" && item.holder !== null ? (
                      <span style={{ display: "block", fontSize: 13 }}>Sold to {holderName(item)}</span>
                    ) : null}
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
                      {selectable ? (
                        <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            aria-label={`Select ${item.title} for a bulk move`}
                            onChange={() => toggle(item.id)}
                          />
                        </label>
                      ) : null}
                      {item.isDeleted ? null : (
                        <SaleButtons
                          status={item.status}
                          busy={running}
                          onRun={(move) => runOnRow(move, item.id)}
                        />
                      )}
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
                        <button
                          className="button button--quiet button--small"
                          type="submit"
                          title="Removes the listing for good"
                        >
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
    </>
  );
}
