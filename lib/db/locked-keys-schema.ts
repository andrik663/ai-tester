import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core"

/**
 * Locked working keys — developer-only, stored permanently in DB.
 *
 * When a developer locks a key, it is stored here with the encrypted raw key
 * so the auto-batch cron can re-test it every 24 h and update its status.
 *
 * Raw keys are AES-256-GCM encrypted using EXPORT_API_TOKEN as the key
 * material. They are NEVER returned over any API — only used server-side
 * for the re-verify batch.
 */
export const lockedWorkingKeys = pgTable(
  "locked_working_keys",
  {
    // Unique per (provider + model + key)
    id: text("id").primaryKey().default(`gen_random_uuid()::text`),
    providerId:   text("provider_id").notNull(),
    providerName: text("provider_name").notNull(),
    modelId:      text("model_id").notNull(),

    // Encrypted raw key (AES-256-GCM, hex). NEVER exposed via API.
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    // Masked display version — safe to return in responses
    apiKeyMasked: text("api_key_masked").notNull(),

    // Latest test result
    isWorking:   boolean("is_working").notNull().default(true),
    latencyMs:   integer("latency_ms"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }).defaultNow(),

    // When developer locked this key
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),

    // Auto-refresh: next scheduled re-test time (default: +24h from lockedAt)
    nextRefreshAt: timestamp("next_refresh_at", { withTimezone: true }).notNull(),

    // How often to re-test in hours (default 24)
    refreshIntervalHours: integer("refresh_interval_hours").notNull().default(24),

    // Last error message if not working
    lastError: text("last_error"),
  },
  (table) => ({
    idxProvider:     index("idx_locked_keys_provider").on(table.providerId),
    idxNextRefresh:  index("idx_locked_keys_next_refresh").on(table.nextRefreshAt),
    idxWorking:      index("idx_locked_keys_working").on(table.isWorking),
  }),
)

// ── Auto-refresh log — history of every re-test ────────────────────────────
export const lockedKeyRefreshLog = pgTable(
  "locked_key_refresh_log",
  {
    id:           text("id").primaryKey().default(`gen_random_uuid()::text`),
    lockedKeyId:  text("locked_key_id").notNull().references(() => lockedWorkingKeys.id, { onDelete: "cascade" }),
    testedAt:     timestamp("tested_at", { withTimezone: true }).notNull().defaultNow(),
    wasWorking:   boolean("was_working").notNull(),
    latencyMs:    integer("latency_ms"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    idxLockedKeyId: index("idx_refresh_log_locked_key_id").on(table.lockedKeyId),
    idxTestedAt:    index("idx_refresh_log_tested_at").on(table.testedAt),
  }),
)

export type LockedWorkingKey    = typeof lockedWorkingKeys.$inferSelect
export type NewLockedWorkingKey = typeof lockedWorkingKeys.$inferInsert
export type LockedKeyRefreshLog = typeof lockedKeyRefreshLog.$inferSelect
