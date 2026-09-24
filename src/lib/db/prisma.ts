import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reloads modules on every change, which
 * would otherwise create a new PrismaClient (and new DB connections) on
 * every save. Caching the instance on `globalThis` avoids connection
 * exhaustion. In production, a fresh client is created once per process.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/*
 * Pool size. `pg` defaults to max: 10 when unset, which measurably queues
 * requests on this app: a single public page renders up to ~19 widgets,
 * each running its own short query (resolveDataSourceKind + the widget's
 * own fetch) concurrently via React's per-node Suspense streaming. Under
 * concurrent page loads, measured against the seeded 28-widget stress
 * page, an 8-request burst against pool size 10 left the slowest request
 * queued to ~18s while the rest finished in ~4-5s. Raised to 25: enough
 * for a couple of busy pages concurrently, well under Postgres's own
 * max_connections (100 by default), and the actual number a real
 * deployment needs should be tuned against its own concurrency and
 * database plan rather than assumed here — hence the env override.
 */
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 25);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: POOL_MAX });

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
