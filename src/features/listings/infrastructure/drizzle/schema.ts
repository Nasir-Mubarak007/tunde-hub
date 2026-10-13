import { sql } from "drizzle-orm";
import { bigint, char, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { users } from "@/features/auth/infrastructure/auth-schema";

export const userRoleEnum = pgEnum("user_role", ["owner", "customer"]);

export const listingStatusEnum = pgEnum("listing_status", ["available", "pending", "sold"]);

export const platformEnum = pgEnum("platform", ["instagram", "x", "tiktok", "facebook", "youtube"]);

export const rateLimitClicks = pgTable(
  "rate_limit_clicks",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    visitorHash: text("visitor_hash").notNull(),
    bucket: timestamp("bucket").notNull(),
    count: integer("count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rate_limit_clicks_visitor_hash_bucket_uindex").on(t.visitorHash, t.bucket),
    index("rate_limit_clicks_bucket_idx").on(t.bucket),
  ]
);

export const listings = pgTable(
  "listings",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    platform: platformEnum("platform").notNull(),
    priceAmount: integer("price_amount").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("NGN"),
    followerCount: integer("follower_count").notNull(),
    accountAgeMonths: integer("account_age_months").notNull(),
    status: listingStatusEnum("status").notNull().default("available"),
    claimedByUserId: text("claimed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    claimToken: text("claim_token").unique(),
    pendingSince: timestamp("pending_since"),
    soldAt: timestamp("sold_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("listings_price_amount_check", sql`${t.priceAmount} >= 0`),
    check("listings_follower_count_check", sql`${t.followerCount} >= 0`),
    check("listings_account_age_months_check", sql`${t.accountAgeMonths} >= 0`),
    uniqueIndex("listings_claimed_by_user_id_pending_uindex")
      .on(t.claimedByUserId)
      .where(sql`${t.status} = 'pending'`),
    index("listings_status_deleted_at_created_at_idx").on(t.status, t.deletedAt, t.createdAt),
    index("listings_created_at_idx").on(t.createdAt),
    index("listings_price_amount_idx").on(t.priceAmount),
    index("listings_follower_count_idx").on(t.followerCount),
    index("listings_account_age_months_idx").on(t.accountAgeMonths),
    index("listings_platform_idx").on(t.platform),
  ]
);

export const listingImages = pgTable(
  "listing_images",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    listingId: bigint("listing_id", { mode: "number" })
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    width: integer("width").notNull(),
    url: text("url").notNull(),
    fileKey: text("file_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("listing_images_width_check", sql`${t.width} IN (320, 768, 1200)`),
    uniqueIndex("listing_images_listing_id_position_width_uindex").on(t.listingId, t.position, t.width),
    index("listing_images_listing_id_position_idx").on(t.listingId, t.position),
  ]
);
