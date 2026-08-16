import { pgTable, serial, text, timestamp, bigint } from "drizzle-orm/pg-core"

/**
 * comments — public feedback/comments shown as a live scrolling ticker in
 * the header (alongside the Independence Day banner). Anyone can post one
 * without an account; a random avatar is generated client-side from a
 * per-row seed so every commenter gets a distinct, deterministic identicon.
 */
export const comments = pgTable("comments", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull().default("Anonim"),
  message:     text("message").notNull(),
  avatarSeed:  text("avatar_seed").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  tsMs:        bigint("ts_ms", { mode: "number" }).notNull().default(0),
})
