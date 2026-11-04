import { pgTable, serial, text, integer, bigint, timestamp, unique, index } from "drizzle-orm/pg-core"

export const gatewayKeys = pgTable("gateway_keys", {
  id: serial("id").primaryKey(),
  providerId: text("provider_id").notNull(),
  providerName: text("provider_name").notNull(),
  apiKey: text("api_key").notNull(),
  modelIds: text("model_ids").array().notNull().default([]),
  avgLatencyMs: integer("avg_latency_ms").notNull().default(0),
  pushedAt: bigint("pushed_at", { mode: "number" }).notNull().default(0),
  // Owner of this synced provider key (msaku.id user_id from mcp_api_keys).
  // NULL = legacy/admin pool: usable by admin and atk_ callers only, NEVER
  // served to an msk_ user. An msk_ user only ever sees rows whose
  // owner_user_id equals their own user_id, so one msk_ user can never
  // spend another user's synced provider key. See scripts/migrate-gateway-owner.mjs.
  ownerUserId: integer("owner_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerKeyUniq: unique("gateway_keys_provider_key_unique").on(t.providerId, t.apiKey),
  // Per-owner uniqueness: the same provider key synced by two different
  // msk_ users becomes two separate rows, one per owner. (Postgres treats
  // NULL owners as distinct, so legacy rows keep using providerKeyUniq.)
  providerKeyOwnerUniq: unique("gateway_keys_provider_key_owner_unique").on(t.providerId, t.apiKey, t.ownerUserId),
  ownerIdx: index("gateway_keys_owner_idx").on(t.ownerUserId),
}))
