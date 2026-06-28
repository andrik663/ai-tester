import { pgTable, serial, text, integer, bigint, timestamp, unique } from "drizzle-orm/pg-core"

export const gatewayKeys = pgTable("gateway_keys", {
  id: serial("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  providerName: text("provider_name").notNull(),
  apiKey: text("api_key").notNull(),
  modelIds: text("model_ids").array().notNull().default([]),
  avgLatencyMs: integer("avg_latency_ms").notNull().default(0),
  pushedAt: bigint("pushed_at", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerKeyUniq: unique("gateway_keys_provider_key_unique").on(t.providerId, t.apiKey),
}))
