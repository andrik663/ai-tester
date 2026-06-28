import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as apiKeySchema from "./api-key-schema"
import * as lockedKeysSchema from "./locked-keys-schema"
import * as userSessionsSchema from "./user-sessions-schema"
import * as gatewaySchema from "./gateway-schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const schema = { ...apiKeySchema, ...lockedKeysSchema, ...userSessionsSchema, ...gatewaySchema }
export const db = drizzle(pool, { schema })
