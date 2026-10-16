/**
 * The owner screenshot uploader for the listing panel.
 * Picks up to six screenshots, resizes each to the 320, 768 and 1200
 * widths in the browser, uploads the files through UploadThing, and
 * hands the resulting variants back to the form. Keyboard reachable
 * with a labelled input and an aria-live status line.
 */
"use client";

import { useRef, useState } from "react";
import { MAX_SCREENSHOTS } from "../../domain/listingImage";
import { resizeScreenshotToWidths } from "./screenshotResize";
import { useUploadThing } from "./uploadthingClient";

/** One uploaded width variant, as the listing forms store it. */
export interface ScreenshotVariant {
  readonly position: number;
  readonly width: number;
  readonly url: string;
  readonly fileKey: string;
}

/** Props for the uploader. Takes the variants plus the change callback. */
export interface ScreenshotUploaderProps {
  readonly value: readonly ScreenshotVariant[];
  readonly onChange: (next: readonly ScreenshotVariant[]) => void;
  readonly disabled?: boolean;
  readonly inputId?: string;
}

/** Groups variants by position. Takes the variants, returns thumbs in position order. */
function thumbsByPosition(value: readonly ScreenshotVariant[]): readonly { position: number; url: string }[] {
  const byPosition = new Map<number, ScreenshotVariant[]>();
  for (const variant of value) {
    const group = byPosition.get(variant.position) ?? [];
    group.push(variant);
    byPosition.set(variant.position, group);
  }
  return [...byPosition.entries()]
    .sort(([a], [b]) => a - b)
    .map(([position, variants]) => {
      const thumb = [...variants].sort((a, b) => a.width - b.width)[0];
      return { position, url: thumb.url };
    });
}

/** Reindexes positions after a removal. Takes the kept variants, returns them 0 based. */
function reindexPositions(variants: readonly ScreenshotVariant[]): ScreenshotVariant[] {
  const positions = [...new Set(variants.map((variant) => variant.position))].sort((a, b) => a - b);
  const remap = new Map(positions.map((position, index) => [position, index]));
  return variants
    .map((variant) => ({ ...variant, position: remap.get(variant.position) ?? variant.position }))
    .sort((a, b) => a.position - b.position || a.width - b.width);
}

/** Renders the uploader. Takes the props, returns the fieldset element. */
export function ScreenshotUploader({ value, onChange, disabled = false, inputId = "screenshots" }: ScreenshotUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const { startUpload } = useUploadThing("listingScreenshot");
  const thumbs = thumbsByPosition(value);
  const remaining = MAX_SCREENSHOTS - thumbs.length;
  const blocked = disabled || busy || remaining <= 0;

  /** Handles picked files. Takes the files, resizes and uploads them, then appends the variants. */
  async function handleFiles(files: readonly File[]): Promise<void> {
    const picked = files.filter((file) => file.type.startsWith("image/")).slice(0, remaining);
    if (picked.length === 0) {
      setStatus(files.length > 0 ? "Pick an image file to add a screenshot." : null);
      return;
    }
    setBusy(true);
    setStatus(`Resizing and uploading ${picked.length === 1 ? "1 screenshot" : `${picked.length} screenshots`}…`);
    try {
      const resized = (
        await Promise.all(picked.map((file, index) => resizeScreenshotToWidths(file, thumbs.length + index)))
      ).flat();
      const lookup = new Map(resized.map((entry) => [entry.file.name, entry]));
      const uploaded = await startUpload(resized.map((entry) => entry.file));
      if (uploaded === undefined || uploaded.length === 0) {
        throw new Error("The upload finished with no files. Try again.");
      }
      const variants: ScreenshotVariant[] = [];
      for (const result of uploaded) {
        const meta = lookup.get(result.name);
        if (meta === undefined) {
          continue;
        }
        const url = result.ufsUrl ?? result.url;
        variants.push({ position: meta.position, width: meta.width, url, fileKey: result.key });
      }
      if (variants.length === 0) {
        throw new Error("The upload finished but no files matched. Try again.");
      }
      onChange([...value, ...variants].sort((a, b) => a.position - b.position || a.width - b.width));
      setStatus(
        variants.length < resized.length
          ? `Uploaded ${variants.length} of ${resized.length} files. The missing ones can be retried.`
          : `Added ${picked.length === 1 ? "1 screenshot" : `${picked.length} screenshots`}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The upload failed. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current !== null) {
        inputRef.current.value = " ";
      }
    }
  }

  /** Removes one screenshot. Takes the position, drops its variants and reindexes. */
  function removeAt(position: number): void {
    onChange(reindexPositions(value.filter((variant) => variant.position !== position)));
    setStatus(`Removed screenshot ${position + 1}.`);
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        Screenshots ({thumbs.length} of {MAX_SCREENSHOTS})
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="field__control"
        type="file"
        accept="image/*"
        multiple
        disabled={blocked}
        onChange={(event) => {
          const files = event.target.files === null ? [] : [...event.target.files];
          void handleFiles(files);
        }}
      />
      <p className="field__hint">
        {remaining > 0
          ? `Up to ${remaining} more. Each photo is resized to three widths before upload.`
          : "Six screenshots is the most a listing holds. Remove one to add another."}
      </p>
      {thumbs.length === 0 ? null : (
        <ul style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: "4px 0 0" }}>
          {thumbs.map((thumb) => (
            <li
              key={thumb.position}
              style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line-strong)", borderRadius: 8, padding: 4 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb.url} alt={`Screenshot ${thumb.position + 1}`} width={64} height={64} style={{ objectFit: "cover", borderRadius: 6 }} />
              <button type="button" className="button button--small button--quiet" disabled={disabled || busy} onClick={() => removeAt(thumb.position)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="field__hint" role="status" aria-live="polite">
        {busy ? "Uploading…" : (status ?? "")}
      </p>
    </div>
  );
}
