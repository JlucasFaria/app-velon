// Prisma client configured with PostgreSQL adapter
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";
import { env } from "../config/env";
import {
  DB_POOL_MAX,
  DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_CONNECT_TIMEOUT_MS,
} from "../config/constants";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: DB_POOL_MAX,
  idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_POOL_CONNECT_TIMEOUT_MS,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export default prisma;
