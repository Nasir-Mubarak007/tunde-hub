/**
 * The claim server action behind the one button.
 * It reads the session, never the form, for who is asking. On success it
 * redirects to the seller chat; on a refusal it redirects back to the same
 * detail page with the reason in the url, so every outcome is a plain link.
 */
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionViewer } from "@/features/auth/infrastructure/sessionViewer";
import { claimListingForBuyer } from "../infrastructure/container";
import { sellerWhatsAppNumber } from "../infrastructure/sellerWhatsAppNumber";
import { hashVisitorAddress, visitorAddress } from "../infrastructure/visitorHash";
import { truncateToHour } from "../domain/rateLimit";
import { buildWhatsAppChatUrl } from "../domain/claimMessage";

/** Where a refusal lands. Takes a slug plus the reason, returns the detail path. */
function detailHref(slug: string | null, reason: string): string {
  const path = slug === null || slug.length === 0 ? "/" : `/listings/${encodeURIComponent(slug)}`;
  return `${path}?claim=${reason}`;
}

/** Presses the claim. Takes the form data, returns nothing: it always redirects. */
export async function claimListingAction(formData: FormData): Promise<void> {
  const rawId = formData.get("listingId");
  const listingId = typeof rawId === "string" ? Number.parseInt(rawId, 10) : Number.NaN;
  if (!Number.isInteger(listingId)) {
    redirect("/");
  }

  const viewer = await getSessionViewer();
  const requestHeaders = await headers();
  const now = new Date();

  if (viewer === null) {
    redirect(detailHref(null, "anonymous-cannot-claim"));
  }

  const result = await claimListingForBuyer(
    {
      listingId,
      buyer: {
        userId: viewer.userId,
        role: viewer.role,
        displayName: viewer.displayName,
        email: viewer.email,
      },
      click: {
        visitorHash: hashVisitorAddress(visitorAddress(requestHeaders)),
        bucket: truncateToHour(now),
      },
    },
    now,
  );

  if (!result.ok) {
    redirect(
      detailHref(result.error.slug, result.error.reason === "already-holds-this-listing" ? "claimed" : result.error.reason),
    );
  }

  const chatUrl = buildWhatsAppChatUrl(sellerWhatsAppNumber(), result.value.message);
  redirect(chatUrl);
}
