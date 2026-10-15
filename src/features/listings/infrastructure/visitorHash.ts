/**
 * The keyed visitor hash used by the rate limit.
 * The raw address never leaves this module: it is hashed with an HMAC
 * keyed by HASH_SECRET before anything is stored.
 */
import { createHmac } from "node:crypto";
import { env } from "@/core/env";

/** Reads the visitor address behind the proxy. Takes the headers, returns the address or unknown. */
export function visitorAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded === null ? null : forwarded.split(",")[0]?.trim();
  if (first !== undefined && first !== null && first.length > 0) {
    return first;
  }
  const real = headers.get("x-real-ip");
  if (real !== null && real.length > 0) {
    return real;
  }
  return "unknown";
}

/** Hashes an address with the keyed secret. Takes the address, returns the stored hash. */
export function hashVisitorAddress(address: string): string {
  const secret = env().HASH_SECRET;
  if (secret === undefined) {
    throw new Error("HASH_SECRET is not set. Add it to the environment before claiming.");
  }
  return createHmac("sha256", secret).update(address).digest("hex");
}
