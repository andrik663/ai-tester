import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as apiKeySchema from "./api-key-schema"
import * as lockedKeysSchema from "./locked-keys-schema"
import * as userSessionsSchema from "./user-sessions-schema"
import * as gatewaySchema from "./gateway-schema"
import * as gatewayLogsSchema from "./gateway-logs-schema"
import * as commentsSchema from "./comments-schema"

// DATABASE_URL is optional — gateway-cache catches DB errors gracefully.
// Throwing at module load time crashes every route that imports this file,
// even routes that never touch the DB (e.g. /api/v1/models when empty).
const connectionString = process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder"

export const pool = new Pool({ connectionString })

const schema = { ...apiKeySchema, ...lockedKeysSchema, ...userSessionsSchema, ...gatewaySchema, ...gatewayLogsSchema, ...commentsSchema }
export const db = drizzle(pool, { schema })
