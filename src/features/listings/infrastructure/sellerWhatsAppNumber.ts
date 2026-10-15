/**
 * The seller WhatsApp number, read once from the environment.
 * Kept out of page text and logs: only the chat link carries it.
 */
import { env } from "@/core/env";

/** Reads the seller number. Takes nothing, returns digits with a country code. Throws loudly when unset. */
export function sellerWhatsAppNumber(): string {
  const value = env().SELLER_WHATSAPP_NUMBER;
  if (value === undefined || value.length === 0) {
    throw new Error(
      "SELLER_WHATSAPP_NUMBER is not set. Add the seller number, digits with a country code and no plus.",
    );
  }
  return value;
}
