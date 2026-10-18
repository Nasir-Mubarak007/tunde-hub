/**
 * The app log as a lifecycle move sink.
 * Spec 0005 records every transition with the listing id, the old state,
 * the new state and the actor id. A move that already reached the
 * database must never be lost because the log refused it, so this
 * implementation swallows its own failures and keeps going.
 */
import type { TransitionLog, TransitionLogEntry } from "../domain/repositories";
import { saleTransitionBreadcrumbs } from "@/features/observability/infrastructure/serverCapture";

/** Records one lifecycle move in the app log. Takes the entry, returns nothing. Never throws. */
export function write(entry: TransitionLogEntry): void {
  try {
    console.info("listing.transition", {
      listingId: entry.listingId,
      from: entry.from,
      to: entry.to,
      actorId: entry.actorId,
    });
  } catch {
    // The write already landed. A log that will not take the entry must not undo it.
  }
  saleTransitionBreadcrumbs.recordTransition(entry);
}

/** The transition log port, assembled from the function above. */
export const appTransitionLog: TransitionLog = {
  write,
};
