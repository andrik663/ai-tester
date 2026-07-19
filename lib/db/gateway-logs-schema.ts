import { pgTable, serial, text, integer, bigint, boolean, timestamp } from "drizzle-orm/pg-core"

/**
 * gateway_logs — one row per request that passes through Miuclaw gateway
 * (/api/v1/chat/completions).
 *
 * Kept deliberately lean: only the fields needed for real-time analytics
 * and live log tailing. Raw request/response bodies are NOT stored.
 */
export const gatewayLogs = pgTable("gateway_logs", {
  id:            serial("id").primaryKey(),

  // Model + provider
  model:         text("model").notNull(),
  providerId:    text("provider_id").notNull(),
  providerName:  text("provider_name").notNull(),

  // Outcome
  success:       boolean("success").notNull().default(false),
  statusCode:    integer("status_code").notNull().default(200),
  latencyMs:     integer("latency_ms").notNull().default(0),
  errorMessage:  text("error_message"),

  // Request metadata
  streaming:     boolean("streaming").notNull().default(false),
  fallbackUsed:  boolean("fallback_used").notNull().default(false),
  attemptCount:  integer("attempt_count").notNull().default(1),

  // Lightweight token accounting (optional — 0 when not available)
  promptTokens:     integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),

  // Wall-clock time (ms since epoch for fast range queries)
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  tsMs:          bigint("ts_ms", { mode: "number" }).notNull().default(0),
})
