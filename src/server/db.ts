import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// PostgreSQL ผ่าน driver adapter — บน Vercel ใช้ DATABASE_URL แบบ pooled (pgbouncer)
const makeClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

// ใช้ instance เดียวทั้งแอป ไม่ให้ hot-reload ของ Next สร้าง connection pool ซ้ำ
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>;
};

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
