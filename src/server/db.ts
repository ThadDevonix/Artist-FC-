import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// ───────────────────────────────────────────────────────────────
// ย้ายไป PostgreSQL ตอน deploy:
//   1. prisma/schema.prisma → provider = "postgresql"
//   2. npm i @prisma/adapter-pg pg
//   3. แทนบล็อกล่างด้วย:
//        import { PrismaPg } from "@prisma/adapter-pg";
//        const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
//   4. npx prisma migrate dev --name init-postgres
// ───────────────────────────────────────────────────────────────

const makeClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? "file:./dev.db",
    }),
  });

// ใช้ instance เดียวทั้งแอป ไม่ให้ hot-reload ของ Next สร้าง connection pool ซ้ำ
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>;
};

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
