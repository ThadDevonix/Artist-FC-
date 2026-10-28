import "server-only";
import { db } from "@/server/db";
import { STAFF_ROLES } from "@/lib/labels";

/** เรียงตามลำดับตำแหน่ง (ประธาน → ผู้จัดการ → หัวหน้าโค้ช → …) แล้วตามชื่อ */
function byRole<T extends { role: (typeof STAFF_ROLES)[number]; name: string }>(list: T[]) {
  return list.sort((a, b) => STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role) || a.name.localeCompare(b.name, "th"));
}

/** ทีมงานของทีม — หน้าเว็บแสดงเฉพาะคนที่ยังอยู่และไม่ได้ถูกซ่อน หลังบ้านเห็นทุกคน */
export async function listTeamStaff(teamId: string, { includeInactive = false } = {}) {
  return byRole(
    await db.staff.findMany({ where: { teamId, ...(includeInactive ? {} : { active: true, hidden: false }) } }),
  );
}

export async function getStaffById(id: string) {
  return db.staff.findUnique({ where: { id } });
}
