/**
 * The WhatsApp handoff text and link.
 * Pure string and URL building, no configuration and no IO here.
 * The seller number arrives as an argument so this module stays pure.
 */

/** The facts the handoff message names. Takes plain values, returns nothing. */
export interface ClaimMessageFacts {
  readonly displayName: string;
  readonly title: string;
  readonly slug: string;
  readonly price: string;
}

/** Builds the chat message. Takes the facts, returns the message text. */
export function buildClaimMessage(facts: ClaimMessageFacts): string {
  return `Hello! I am ${facts.displayName} and I would like to buy "${facts.title}" (${facts.slug}) listed at ${facts.price}.`;
}

/** Builds the seller chat link. Takes the seller digits plus the message, returns the url. */
export function buildWhatsAppChatUrl(sellerNumber: string, message: string): string {
  return `https://wa.me/${sellerNumber}?text=${encodeURIComponent(message)}`;
}
