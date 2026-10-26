import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // migration ต้องต่อตรง ไม่ผ่าน pgbouncer → ใช้ UNPOOLED ถ้ามี (Neon/Vercel ตั้งให้อัตโนมัติ)
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
