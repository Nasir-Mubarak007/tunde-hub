/**
 * The rate limit storage Better Auth signs against.
 *
 * Spec 0002 puts signup and claim on one cap: five attempts per hour per
 * keyed visitor hash, counted in `rate_limit_clicks`, never the address.
 * Better Auth hands us a key of the shape `${ip}|${path}`, so the address
 * half is hashed with the same keyed hash the claim path uses and the two
 * share one counter per hour.
 *
 * A path with any other window keeps Better Auth's own short window in
 * process memory, because one path can only carry one rule and the table
 * stores hour buckets. That fallback is a guard on the cheap auth reads,
 * not the shop's abuse limit.
 */
import { RATE_LIMIT_MAX_ATTEMPTS, truncateToHour } from "@/features/listings/domain/rateLimit";
import { hashVisitorAddress } from "@/features/listings/infrastructure/visitorHash";
import { rateLimitStore } from "@/features/listings/infrastructure/drizzle/claimStore";

/** The window in seconds that marks a rule as the hourly shop cap. */
const HOURLY_WINDOW_SECONDS = 3600;

/** One in process counter, used for the short window rules. */
interface MemoryEntry {
  count: number;
  expiresAt: number;
}

/** The short window counters. Bounded so a long running process cannot grow it forever. */
const memory = new Map<string, MemoryEntry>();

/** How many short window entries are kept before the oldest are dropped. */
const MEMORY_MAX_ENTRIES = 10_000;

/** Drops expired and overflowing entries. Takes nothing, returns nothing. */
function pruneMemory(nowMs: number): void {
  for (const [key, entry] of memory) {
    if (nowMs >= entry.expiresAt) {
      memory.delete(key);
    }
  }
  while (memory.size > MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next();
    if (oldest.done === true) {
      return;
    }
    memory.delete(oldest.value);
  }
}

/** Splits a Better Auth rate limit key into its address and path halves. Takes the key, returns both. */
function splitKey(key: string): { address: string; path: string } {
  const separator = key.indexOf("|");
  if (separator === -1) {
    return { address: key, path: "" };
  }
  return { address: key.slice(0, separator), path: key.slice(separator + 1) };
}

/** Counts against the shared hourly table. Takes the key plus the rule, returns the decision. */
async function consumeHourly(key: string): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const { address } = splitKey(key);
  const now = new Date();
  const bucket = truncateToHour(now);
  const count = await rateLimitStore.incrementAndGetCount(hashVisitorAddress(address), bucket);
  if (count < RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: true, retryAfter: null };
  }
  const nextHour = new Date(bucket.getTime() + 3600_000);
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((nextHour.getTime() - now.getTime()) / 1000)) };
}

/** Counts against the in process short window. Takes the key plus the rule, returns the decision. */
function consumeMemory(
  key: string,
  rule: { window: number; max: number },
): { allowed: boolean; retryAfter: number | null } {
  const nowMs = Date.now();
  pruneMemory(nowMs);
  const windowMs = rule.window * 1000;
  const entry = memory.get(key);
  if (entry === undefined) {
    memory.set(key, { count: 1, expiresAt: nowMs + windowMs });
    return { allowed: true, retryAfter: null };
  }
  if (entry.count >= rule.max) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.expiresAt - nowMs) / 1000)) };
  }
  entry.count += 1;
  entry.expiresAt = nowMs + windowMs;
  return { allowed: true, retryAfter: null };
}

/**
 * The storage Better Auth calls on every rate limited request.
 * Takes the key plus the rule, returns whether the request is allowed and
 * how long to wait when it is not.
 */
export async function consumeRateLimit(
  key: string,
  rule: { window: number; max: number },
): Promise<{ allowed: boolean; retryAfter: number | null }> {
  if (rule.window === HOURLY_WINDOW_SECONDS) {
    return consumeHourly(key);
  }
  return consumeMemory(key, rule);
}

/** The storage object Better Auth wants. Wraps consume so the shape is explicit. */
export const authRateLimitStorage = { consume: consumeRateLimit };