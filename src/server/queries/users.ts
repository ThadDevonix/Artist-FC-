import "server-only";
import { db } from "@/server/db";

export async function getUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}

/** ผู้ใช้ทั้งหมด พร้อมผู้ตัดสินที่ผูกกับบัญชี (ถ้ามี) */
export async function listUsers() {
  return db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { official: { select: { id: true, name: true } } },
  });
}

/** บัญชีที่เปิดใช้งาน — ใช้ในช่อง "ผูกกับบัญชีผู้ใช้" ของผู้ตัดสิน */
export async function listActiveUsers() {
  return db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, official: { select: { id: true } } },
  });
}
