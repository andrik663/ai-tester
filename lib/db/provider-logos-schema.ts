import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const providerLogos = pgTable("provider_logos", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
  providerId: text("provider_id").notNull().unique(),
  providerName: text("provider_name").notNull(),
  svgUrl: text("svg_url").notNull(),
  svgVariant: text("svg_variant").default("default"),
  logoSource: text("logo_source").default("thesvg.org"),
  category: text("category"),
  description: text("description"),
  colors: jsonb("colors").$type<Record<string, string>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
})

export type ProviderLogo = typeof providerLogos.$inferSelect
export type NewProviderLogo = typeof providerLogos.$inferInsert
