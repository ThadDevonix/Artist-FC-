import "server-only";
import { db } from "@/server/db";
import { BOOKING_EVENTS } from "@/lib/labels";

/** ผู้ตัดสินทั้งหมด (หลังบ้าน) พร้อมบัญชีที่ผูกและจำนวนนัดที่เป็นผู้ตัดสินที่ 1 */
export async function listOfficials() {
  return db.official.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { refereeMatches: true } },
    },
  });
}

/** ผู้ตัดสินที่ยังทำหน้าที่อยู่ — ใช้ในช่องเลือกทีมผู้ตัดสินของนัด */
export async function listActiveOfficials() {
  return db.official.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getOfficialById(id: string) {
  return db.official.findUnique({ where: { id } });
}

export type RefereeStatRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  matches: number;
  yellow: number;
  red: number;
};

/**
 * สถิติผู้ตัดสินของฤดูกาล — นับจากผู้ตัดสินที่ 1 ของนัดที่อนุมัติแล้ว
 * ตามกติกา ผู้ตัดสินที่ 1 เป็นคนแจกใบทุกใบ จึงไม่ต้องให้กรอกว่าใครแจก
 * ใบเหลืองที่ 2 นับเป็นใบเหลือง (ใบแดงจากใบเหลืองที่ 2 ไม่ถูกนับซ้ำเป็นใบแดง)
 */
export async function getRefereeStats(seasonId: string): Promise<RefereeStatRow[]> {
  const matches = await db.match.findMany({
    where: { seasonId, status: "FINISHED", refereeId: { not: null } },
    select: {
      referee: { select: { id: true, name: true, photoUrl: true } },
      events: { where: { type: { in: [...BOOKING_EVENTS, "RED"] } }, select: { type: true } },
    },
  });

  const rows = new Map<string, RefereeStatRow>();
  for (const m of matches) {
    if (!m.referee) continue;
    const row = rows.get(m.referee.id) ?? { ...m.referee, matches: 0, yellow: 0, red: 0 };
    row.matches++;
    for (const e of m.events) {
      if (e.type === "RED") row.red++;
      else row.yellow++;
    }
    rows.set(m.referee.id, row);
  }
  return [...rows.values()].sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name, "th"));
}
