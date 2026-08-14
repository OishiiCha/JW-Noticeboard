import { PrismaClient } from "@prisma/client";
import { bumpDataVersion } from "@/lib/data-version";

const PRISMA_CACHE_VERSION = "noticeboard-v1";

const WRITE_OPS = new Set([
  "create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany",
]);

// Models whose writes shouldn't trigger client refreshes
const SILENT_MODELS = new Set(["ActionLog", "BackupLog"]);

function createClient(config: ConstructorParameters<typeof PrismaClient>[0]) {
  return new PrismaClient(config).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, query, args }) {
          const result = await query(args);
          if (WRITE_OPS.has(operation) && !SILENT_MODELS.has(model)) bumpDataVersion();
          return result;
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  [key: string]: ExtendedClient;
};

const poolConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "file:./data/noticeboard.db",
    },
  },
};

export const db =
  globalForPrisma[PRISMA_CACHE_VERSION] ?? createClient(poolConfig);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma[PRISMA_CACHE_VERSION] = db;
}

if (process.env.DATABASE_URL?.includes("file:")) {
  db.$queryRaw`PRAGMA journal_mode=WAL;`;
  db.$queryRaw`PRAGMA busy_timeout=5000;`;
}
