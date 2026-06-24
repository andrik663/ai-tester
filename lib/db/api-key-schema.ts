import { pgTable, text, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core"

// API Keys table
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey().default(`gen_random_uuid()::text`),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    rateLimitPerHour: integer("rate_limit_per_hour").default(100),
    allowedEndpoints: text("allowed_endpoints").array().default(["*"]),
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    metadata: jsonb("metadata").default({}),
    description: text("description"),
  },
  (table) => ({
    idxKeyHash: index("idx_api_keys_key_hash").on(table.keyHash),
    idxCreatedBy: index("idx_api_keys_created_by").on(table.createdBy),
  })
)

// API Usage Logs table
export const apiUsageLogs = pgTable(
  "api_usage_logs",
  {
    id: text("id").primaryKey().default(`gen_random_uuid()::text`),
    apiKeyId: text("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    method: text("method").notNull(),
    statusCode: integer("status_code"),
    requestAt: timestamp("request_at", { withTimezone: true }).notNull().defaultNow(),
    responseTimeMs: integer("response_time_ms"),
    requestBodySize: integer("request_body_size"),
    responseBodySize: integer("response_body_size"),
    errorMessage: text("error_message"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    idxApiKeyId: index("idx_api_usage_logs_api_key_id").on(table.apiKeyId),
    idxRequestAt: index("idx_api_usage_logs_request_at").on(table.requestAt),
  })
)

export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect
export type NewApiUsageLog = typeof apiUsageLogs.$inferInsert
