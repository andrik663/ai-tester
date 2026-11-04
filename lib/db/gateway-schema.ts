import { pgTable, serial, text, integer, bigint, timestamp, unique, index, boolean } from "drizzle-orm/pg-core"

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
  // served to an msk_ user — EXCEPT rows marked shared below. An msk_ user
  // sees rows whose owner_user_id equals their own user_id, PLUS shared
  // rows, so one msk_ user can never spend another user's private key.
  // See scripts/migrate-gateway-owner.mjs.
  ownerUserId: integer("owner_user_id"),
  // Admin-shared key: when true, this row is served to EVERY registered
  // msk_ user (as a fallback behind their own keys), regardless of owner.
  // Only an admin push may set this to true; msk_/atk_ pushes are forced
  // to false server-side. Revoking is instant: set it false (or delete
  // the row) and the model disappears for all msk_ users within the cache TTL.
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerKeyUniq: unique("gateway_keys_provider_key_unique").on(t.providerId, t.apiKey),
  // Per-owner uniqueness: the same provider key synced by two different
  // msk_ users becomes two separate rows, one per owner. (Postgres treats
  // NULL owners as distinct, so legacy rows keep using providerKeyUniq.)
  providerKeyOwnerUniq: unique("gateway_keys_provider_key_owner_unique").on(t.providerId, t.apiKey, t.ownerUserId),
  ownerIdx: index("gateway_keys_owner_idx").on(t.ownerUserId),
  sharedIdx: index("gateway_keys_shared_idx").on(t.isShared),
}))
