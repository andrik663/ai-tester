import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as apiKeySchema from "./api-key-schema"
import * as lockedKeysSchema from "./locked-keys-schema"
import * as gatewaySchema from "./gateway-schema"
import * as gatewayLogsSchema from "./gateway-logs-schema"
import * as commentsSchema from "./comments-schema"
import * as providerLogosSchema from "./provider-logos-schema"

// DATABASE_URL is optional — gateway-cache catches DB errors gracefully.
// Throwing at module load time crashes every route that imports this file,
// even routes that never touch the DB (e.g. /api/v1/models when empty).
// Using @neondatabase/serverless over HTTP avoids raw TCP sockets in
// Cloudflare Workers (no cross-request I/O errors and lower edge latency).
const connectionString =
  process.env.DATABASE_URL ??
  "postgres://placeholder:placeholder@ep-placeholder.us-east-2.aws.neon.tech/placeholder"

export const sql = neon(connectionString)

const fullResultsSql = neon(connectionString, { fullResults: true })

export const pool = {
  query: (text: string, params?: unknown[]) => fullResultsSql.query(text, params),
  connect: async () => ({
    query: (text: string, params?: unknown[]) => fullResultsSql.query(text, params),
    release: () => {},
  }),
}

const schema = {
  ...apiKeySchema,
  ...lockedKeysSchema,
  ...gatewaySchema,
  ...gatewayLogsSchema,
  ...commentsSchema,
  ...providerLogosSchema,
}

export const db = drizzle(sql, { schema })
