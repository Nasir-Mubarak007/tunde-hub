/**
 * Drizzle implementation of the atomic claim write.
 * One transaction holds the click count, the rate limit decision and the
 * conditional update, so a refused claim still counts and two simultaneous
 * presses cannot both win. Storage failures throw; domain refusals stay values.
 */
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/db";
import type { Listing } from "../../domain/listing";
import { isRateLimited } from "../../domain/rateLimit";
import type { ClaimAttemptInput, ClaimAttemptResult, ClaimClick, ClaimStore, RateLimitStore } from "../../domain/repositories";
import { listings, rateLimitClicks } from "./schema";
import { toListing } from "./listingMapper";

/** The transaction handle the helpers inside one claim write receive. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Postgres error code for a unique index violation, the one pending cap. */
const UNIQUE_VIOLATION = "23505";

/** Tells whether a thrown value is a unique index violation. Takes the error, returns the answer. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

/** Counts one click for the visitor and hour bucket. Takes the transaction plus the click, returns the new count. */
async function incrementClick(tx: Transaction, click: ClaimClick): Promise<number> {
  const rows = await tx
    .insert(rateLimitClicks)
    .values({ visitorHash: click.visitorHash, bucket: click.bucket, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitClicks.visitorHash, rateLimitClicks.bucket],
      set: { count: sql`${rateLimitClicks.count} + 1` },
    })
    .returning({ count: rateLimitClicks.count });
  const row = rows[0];
  if (row === undefined) {
    throw new Error("Click count did not come back from the rate limit upsert.");
  }
  return row.count;
}

/** Attempts the claim. Takes the attempt facts, returns the outcome. */
export async function attemptClaim(input: ClaimAttemptInput): Promise<ClaimAttemptResult> {
  return db.transaction(async (tx) => {
    const clickCount = input.click === null ? 0 : await incrementClick(tx, input.click);
    if (isRateLimited(clickCount)) {
      return { outcome: "rate-limited", clickCount };
    }

    const held = await tx
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          eq(listings.claimedByUserId, input.buyerId),
          eq(listings.status, "pending"),
          isNull(listings.deletedAt),
          ne(listings.id, input.listingId),
        ),
      )
      .limit(1);
    if (held.length > 0) {
      return { outcome: "buyer-capped", clickCount };
    }

    let claimed: Listing[];
    try {
      claimed = await tx
        .update(listings)
        .set({
          status: "pending",
          claimedByUserId: input.buyerId,
          claimToken: input.token,
          pendingSince: input.now,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(listings.id, input.listingId),
            eq(listings.status, "available"),
            isNull(listings.deletedAt),
          ),
        )
        .returning();
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { outcome: "buyer-capped", clickCount };
      }
      throw error;
    }

    const row = claimed[0];
    if (row === undefined) {
      return { outcome: "taken", clickCount };
    }
    return { outcome: "claimed", listing: toListing(row), clickCount };
  });
}

/** Increments the bucket and returns the new count. Takes the hash plus the bucket, returns the count. */
export async function incrementAndGetCount(visitorHash: string, bucket: Date): Promise<number> {
  return db.transaction((tx) => incrementClick(tx, { visitorHash, bucket }));
}

/** Removes rows older than the cutoff. Takes the cutoff, returns the removed row count. */
export async function pruneOlderThan(cutoff: Date): Promise<number> {
  const rows = await db
    .delete(rateLimitClicks)
    .where(sql`${rateLimitClicks.bucket} < ${cutoff}`)
    .returning({ id: rateLimitClicks.id });
  return rows.length;
}

/** The claim port, assembled from the functions above. */
export const claimStore: ClaimStore = {
  attemptClaim,
};

/** The rate limit port, assembled from the functions above. */
export const rateLimitStore: RateLimitStore = {
  incrementAndGetCount,
  pruneOlderThan,
};
