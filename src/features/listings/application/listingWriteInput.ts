/**
 * The boundary shapes for owner listing writes.
 * A panel form hands over strings; Zod turns them into the plain numbers
 * and enums the domain expects, and every refusal comes back as a field
 * keyed issue list the panel can render, never as a thrown error.
 */
import { z } from "zod";
import { IMAGE_WIDTHS, MAX_POSITION, MAX_SCREENSHOTS, MIN_POSITION } from "../domain/listingImage";

/** One screenshot variant as a form sends it. All fields arrive as strings. */
const imageVariantSchema = z.object({
  position: z.coerce.number().int().min(MIN_POSITION).max(MAX_POSITION),
  width: z.coerce.number().int().refine((width) => (IMAGE_WIDTHS as readonly number[]).includes(width), {
    message: "Unsupported width",
  }),
  url: z.string().trim().url(),
  fileKey: z.string().trim().min(1).nullish(),
});

/** The create form. Screenshots are optional; a listing may ship with none. */
export const createListingCommandSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(160, "Title is too long"),
  platform: z.string().trim().min(1, "Pick a platform"),
  priceAmount: z.coerce.number().int().min(0, "Price cannot be negative"),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Currency is three uppercase letters")
    .default("NGN"),
  followerCount: z.coerce.number().int().min(0, "Follower count cannot be negative"),
  accountAgeMonths: z.coerce.number().int().min(0, "Account age cannot be negative"),
  description: z
    .string()
    .trim()
    .max(4000, "Description is too long")
    .nullish()
    .transform((value) => (value === undefined || value === null || value.length === 0 ? null : value)),
  images: z
    .array(imageVariantSchema)
    .max(MAX_SCREENSHOTS * IMAGE_WIDTHS.length, `At most ${MAX_SCREENSHOTS} screenshots`)
    .default([]),
});

/** The update form. Every field is optional, so the panel can send only what changed. */
export const updateListingCommandSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(160, "Title is too long").optional(),
  platform: z.string().trim().min(1, "Pick a platform").optional(),
  priceAmount: z.coerce.number().int().min(0, "Price cannot be negative").optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Currency is three uppercase letters")
    .optional(),
  followerCount: z.coerce.number().int().min(0, "Follower count cannot be negative").optional(),
  accountAgeMonths: z.coerce.number().int().min(0, "Account age cannot be negative").optional(),
  description: z
    .string()
    .trim()
    .max(4000, "Description is too long")
    .nullish()
    .transform((value) => (value === undefined ? undefined : value === null || value.length === 0 ? null : value)),
  images: z.array(imageVariantSchema).optional(),
});

/** One field level problem, as the panel renders it beside the input. */
export interface FieldIssue {
  readonly field: string;
  readonly message: string;
}

/** A create command after the boundary accepted it. */
export type CreateListingCommand = z.infer<typeof createListingCommandSchema>;

/** An update command after the boundary accepted it. */
export type UpdateListingCommand = z.infer<typeof updateListingCommandSchema>;

/** Flattens a Zod failure into field keyed issues. Takes the error, returns the issues. */
function toFieldIssues(error: z.ZodError): readonly FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

/** Parses a create command. Takes the raw form values, returns the command or the field issues. */
export function parseCreateListingCommand(
  raw: unknown,
): { ok: true; value: CreateListingCommand } | { ok: false; issues: readonly FieldIssue[] } {
  const parsed = createListingCommandSchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return { ok: false, issues: toFieldIssues(parsed.error) };
}

/** Parses an update command. Takes the raw form values, returns the command or the field issues. */
export function parseUpdateListingCommand(
  raw: unknown,
): { ok: true; value: UpdateListingCommand } | { ok: false; issues: readonly FieldIssue[] } {
  const parsed = updateListingCommandSchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  return { ok: false, issues: toFieldIssues(parsed.error) };
}