import "server-only";
import { db } from "@/server/db";

/** ฟิลด์ทีมชุดมาตรฐานที่ใช้แสดงผลทั่วเว็บ */
export const teamCardSelect = {
  id: true, name: true, shortName: true, slug: true,
  logoUrl: true, color: true, color2: true, code: true,
} as const;

export async function getTeamBySlug(slug: string) {
  return db.team.findUnique({ where: { slug } });
}

export async function getTeamById(id: string) {
  return db.team.findUnique({ where: { id } });
}

/** ทีมทั้งหมดที่อยู่ในฤดูกาลนี้ */
export async function listSeasonTeams(seasonId: string) {
  return db.team.findMany({
    where: { seasons: { some: { seasonId } } },
    orderBy: { name: "asc" },
    select: teamCardSelect,
  });
}

export async function countSeasonTeams(seasonId: string) {
  return db.team.count({ where: { seasons: { some: { seasonId } } } });
}

/** ทีมทั้งหมดในระบบ (ไม่จำกัดฤดูกาล) — ใช้ในหลังบ้าน */
export async function listAllTeams() {
  return db.team.findMany({ orderBy: { name: "asc" } });
}

/** ทีมพร้อมจำนวนนักเตะ สำหรับหน้าจัดการสโมสร */
export async function listTeamsWithPlayerCount() {
  return db.team.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { players: true } } },
  });
}

/** รหัสทีมที่มีผลแข่งจบแล้ว — ทีมเหล่านี้ลบไม่ได้ */
export async function teamIdsWithResults(): Promise<Set<string>> {
  const [home, away] = await Promise.all([
    db.match.groupBy({ by: ["homeTeamId"], where: { status: "FINISHED" }, _count: true }),
    db.match.groupBy({ by: ["awayTeamId"], where: { status: "FINISHED" }, _count: true }),
  ]);
  return new Set([...home.map((h) => h.homeTeamId), ...away.map((a) => a.awayTeamId)]);
}

/** รหัสทีมที่อยู่ในฤดูกาลนี้ */
export async function seasonTeamIds(seasonId: string): Promise<Set<string>> {
  const rows = await db.seasonTeam.findMany({ where: { seasonId }, select: { teamId: true } });
  return new Set(rows.map((r) => r.teamId));
}
