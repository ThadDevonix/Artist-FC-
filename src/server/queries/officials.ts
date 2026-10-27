import "server-only";
import { db } from "@/server/db";
import { CARD_EVENTS } from "@/lib/labels";

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
 * สถิติผู้ตัดสินของฤดูกาล (นัดที่อนุมัติแล้ว)
 * - นัด = จำนวนนัดที่อยู่ในทีมผู้ตัดสิน (ช่องใดก็ได้)
 * - ใบ  = นับให้ "ผู้ให้ใบ" ที่บันทึกไว้ ถ้าไม่ได้บันทึก (ข้อมูลเก่า) นับให้ผู้ตัดสินที่ 1 ของนัด
 * ใบเหลืองที่ 2 นับเป็นใบเหลือง (ใบแดงจากใบเหลืองที่ 2 ไม่ถูกนับซ้ำเป็นใบแดง)
 */
export async function getRefereeStats(seasonId: string): Promise<RefereeStatRow[]> {
  const person = { select: { id: true, name: true, photoUrl: true } } as const;
  const matches = await db.match.findMany({
    where: { seasonId, status: "FINISHED" },
    select: {
      referee: person,
      assistant1: person,
      assistant2: person,
      fourthOfficial: person,
      events: { where: { type: { in: CARD_EVENTS } }, select: { type: true, issuedBy: person } },
    },
  });

  const rows = new Map<string, RefereeStatRow>();
  const row = (p: { id: string; name: string; photoUrl: string | null }) => {
    const r = rows.get(p.id) ?? { ...p, matches: 0, yellow: 0, red: 0 };
    rows.set(p.id, r);
    return r;
  };

  for (const m of matches) {
    const crew = [m.referee, m.assistant1, m.assistant2, m.fourthOfficial].filter((o) => o !== null);
    for (const o of new Map(crew.map((c) => [c.id, c])).values()) row(o).matches++;
    for (const e of m.events) {
      const issuer = e.issuedBy ?? m.referee;
      if (!issuer) continue;
      if (e.type === "RED") row(issuer).red++;
      else row(issuer).yellow++;
    }
  }
  return [...rows.values()].sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name, "th"));
}
