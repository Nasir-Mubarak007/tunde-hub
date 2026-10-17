/**
 * The owner listing form.
 * One client form for both create and edit. It holds the field state,
 * collects screenshots through the uploader, then calls the matching
 * server action. Server answers arrive as values, so field problems print
 * beside the right input and success lands back on the panel list.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { PLATFORMS, PLATFORM_LABELS } from "../domain/platform";
import type { Platform } from "../domain/platform";
import type { FieldIssue } from "../application/listingWriteInput";
import { Field } from "@/shared/ui/field";
import { Button } from "@/shared/ui/button";
import { ScreenshotUploader } from "./components/screenshotUploader";
import type { ScreenshotVariant } from "./components/screenshotUploader";
import { createListingFromForm, updateListingFromForm } from "./adminListingActions";

/** Starting values for the form. Edit passes the stored row, create passes nothing. */
export interface ListingFormInitial {
  readonly title: string;
  readonly platform: string;
  readonly priceAmount: number;
  readonly currency: string;
  readonly followerCount: number;
  readonly accountAgeMonths: number;
  readonly description: string;
  readonly images: readonly ScreenshotVariant[];
}

/** What the form needs. Mode decides which server action runs. */
export interface ListingFormProps {
  readonly mode: "create" | "edit";
  readonly listingId?: number;
  readonly initial?: ListingFormInitial;
}

/** Empty values for a fresh listing. Takes nothing, returns the blank shape. */
function blankInitial(): ListingFormInitial {
  return {
    title: "",
    platform: "instagram",
    priceAmount: 0,
    currency: "NGN",
    followerCount: 0,
    accountAgeMonths: 0,
    description: "",
    images: [],
  };
}

/** Finds the first issue for a field. Takes issues plus the field, returns the message or undefined. */
function issueFor(issues: readonly FieldIssue[], field: string): string | undefined {
  return issues.find((issue) => issue.field === field || issue.field.startsWith(`${field}.`))?.message;
}

/** Renders the form. Takes mode plus optional initial values, returns the form element. */
export function ListingForm({ mode, listingId, initial }: ListingFormProps) {
  const router = useRouter();
  const start = initial ?? blankInitial();
  const [title, setTitle] = useState(start.title);
  const [platform, setPlatform] = useState(start.platform);
  const [priceAmount, setPriceAmount] = useState(String(start.priceAmount));
  const [currency, setCurrency] = useState(start.currency);
  const [followerCount, setFollowerCount] = useState(String(start.followerCount));
  const [accountAgeMonths, setAccountAgeMonths] = useState(String(start.accountAgeMonths));
  const [description, setDescription] = useState(start.description);
  const [images, setImages] = useState<readonly ScreenshotVariant[]>(start.images);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Submits the form. Takes the submit event, calls the server action, then lands on the panel. */
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setIssues([]);
    setMessage(null);
    const raw = {
      title,
      platform,
      priceAmount,
      currency,
      followerCount,
      accountAgeMonths,
      description,
      images: images.map((image) => ({
        position: image.position,
        width: image.width,
        url: image.url,
        fileKey: image.fileKey,
      })),
    };
    const result =
      mode === "create" ? await createListingFromForm(raw) : await updateListingFromForm(listingId ?? 0, raw);
    if (!result.ok) {
      setIssues(result.issues ?? []);
      setMessage(result.message ?? "Check the highlighted fields and try again.");
      setBusy(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} aria-label={mode === "create" ? "Add a listing" : "Edit a listing"}>
      {message === null ? null : (
        <p className="panel panel--notice" role="alert">
          {message}
        </p>
      )}
      <Field label="Title" htmlFor="listing-title" error={issueFor(issues, "title")}>
        <input
          id="listing-title"
          name="title"
          className="field__control"
          type="text"
          maxLength={160}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <div className="filters__grid">
        <Field label="Platform" htmlFor="listing-platform" error={issueFor(issues, "platform")}>
          <select
            id="listing-platform"
            name="platform"
            className="field__control"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            {PLATFORMS.map((value: Platform) => (
              <option key={value} value={value}>
                {PLATFORM_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price (whole Naira)" htmlFor="listing-price" error={issueFor(issues, "priceAmount")}>
          <input
            id="listing-price"
            name="priceAmount"
            className="field__control"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            value={priceAmount}
            onChange={(event) => setPriceAmount(event.target.value)}
          />
        </Field>
        <Field label="Currency" htmlFor="listing-currency" hint="Three uppercase letters" error={issueFor(issues, "currency")}>
          <input
            id="listing-currency"
            name="currency"
            className="field__control"
            type="text"
            maxLength={3}
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Followers" htmlFor="listing-followers" error={issueFor(issues, "followerCount")}>
          <input
            id="listing-followers"
            name="followerCount"
            className="field__control"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            value={followerCount}
            onChange={(event) => setFollowerCount(event.target.value)}
          />
        </Field>
        <Field label="Account age (months)" htmlFor="listing-age" error={issueFor(issues, "accountAgeMonths")}>
          <input
            id="listing-age"
            name="accountAgeMonths"
            className="field__control"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            required
            value={accountAgeMonths}
            onChange={(event) => setAccountAgeMonths(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Description" htmlFor="listing-description" hint="Optional free text" error={issueFor(issues, "description")}>
        <textarea
          id="listing-description"
          name="description"
          className="field__control"
          rows={5}
          maxLength={4000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <ScreenshotUploader value={images} onChange={setImages} inputId="listing-screenshots" />
      {issueFor(issues, "images") === undefined ? null : (
        <p className="field__hint" role="alert">
          {issueFor(issues, "images")}
        </p>
      )}
      <div className="filters__actions">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Add listing" : "Save changes"}
        </Button>
        <Button variant="quiet" href="/admin">
          Back to panel
        </Button>
      </div>
    </form>
  );
}
