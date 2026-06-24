import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core"

/**
 * Public user temporary sessions.
 *
 * When a public user runs a batch test, a session is created in this table.
 * The session grants access to working-key data (masked only) for a fixed TTL
 * (default 1 hour). After expiry, all associated batch results are purged.
 *
 * No real authentication — the session token IS the credential (like a
 * signed URL). It is generated as a crypto.randomUUID() and returned once to
 * the browser, which stores it in sessionStorage (not localStorage).
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: text("id").primaryKey().default(`gen_random_uuid()::text`),

    // Opaque token returned to the user browser — stored in sessionStorage
    sessionToken: text("session_token").notNull().unique(),

    // Fingerprint for abuse detection (hashed IP + user-agent)
    fingerprint: text("fingerprint"),

    // When this session was created
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    // When this session expires — data auto-purged after this time
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    // TTL in minutes (default 60)
    ttlMinutes: integer("ttl_minutes").notNull().default(60),

    // Has the user already run a batch in this session?
    batchRan: boolean("batch_ran").notNull().default(false),

    // Timestamp of first batch run (rate-limit: 1 batch per session)
    batchRanAt: timestamp("batch_ran_at", { withTimezone: true }),

    // How many working keys were found in their batch
    workingKeysCount: integer("working_keys_count").default(0),

    // Whether the session is still valid (can be revoked early by developer)
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    idxToken:     index("idx_user_sessions_token").on(table.sessionToken),
    idxExpiresAt: index("idx_user_sessions_expires_at").on(table.expiresAt),
  })
)

/**
 * Temporary batch results for public users.
 *
 * When a user's batch completes, ONLY masked working keys are stored here.
 * Raw keys are NEVER stored. Records are deleted when the session expires.
 */
export const userBatchResults = pgTable(
  "user_batch_results",
  {
    id: text("id").primaryKey().default(`gen_random_uuid()::text`),

    // FK to userSessions
    sessionId: text("session_id").notNull().references(() => userSessions.id, { onDelete: "cascade" }),

    // Provider and model info
    providerId:   text("provider_id").notNull(),
    providerName: text("provider_name").notNull(),
    modelId:      text("model_id").notNull(),

    // Masked key — NEVER the raw key
    apiKeyMasked: text("api_key_masked").notNull(),

    // Test result
    isWorking:  boolean("is_working").notNull().default(true),
    latencyMs:  integer("latency_ms"),
    testedAt:   timestamp("tested_at", { withTimezone: true }).notNull().defaultNow(),

    // Session expiry copied here for fast cleanup queries
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    idxSessionId: index("idx_user_batch_results_session_id").on(table.sessionId),
    idxExpiresAt: index("idx_user_batch_results_expires_at").on(table.expiresAt),
  })
)

export type UserSession       = typeof userSessions.$inferSelect
export type NewUserSession     = typeof userSessions.$inferInsert
export type UserBatchResult    = typeof userBatchResults.$inferSelect
export type NewUserBatchResult = typeof userBatchResults.$inferInsert
