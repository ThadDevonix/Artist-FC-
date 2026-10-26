import "server-only";
import { db } from "@/server/db";

export async function getUserById(id: string) {
  return db.user.findUnique({ where: { id } });
}

/** ผู้ใช้ทั้งหมด พร้อมจำนวนนัดที่ดูแล */
export async function listUsers() {
  return db.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { _count: { select: { refereeFor: true } } },
  });
}

/** ผู้ใช้ที่เปิดใช้งาน — ใช้ในช่องเลือกผู้ตัดสิน */
export async function listActiveUsers() {
  return db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}
