import "server-only";
import { db } from "@/server/db";
import type { Position } from "@/generated/prisma/enums";

export async function getPlayerBySlug(slug: string) {
  return db.player.findUnique({ where: { slug }, include: { team: true } });
}

export async function getPlayerById(id: string) {
  return db.player.findUnique({ where: { id } });
}

/** นักเตะในฤดูกาล พร้อมตัวกรองของหน้าเว็บ */
export async function listSeasonPlayers(
  seasonId: string,
  filters: { teamSlug?: string; position?: Position; search?: string } = {},
) {
  return db.player.findMany({
    where: {
      active: true,
      team: {
        seasons: { some: { seasonId } },
        ...(filters.teamSlug ? { slug: filters.teamSlug } : {}),
      },
      ...(filters.position ? { position: filters.position } : {}),
      ...(filters.search ? { name: { contains: filters.search } } : {}),
    },
    orderBy: [{ team: { name: "asc" } }, { number: "asc" }],
    select: {
      id: true, name: true, slug: true, number: true, position: true,
      nationality: true, photoUrl: true,
      team: { select: { name: true, shortName: true, slug: true, logoUrl: true, color: true, color2: true } },
    },
  });
}

/** นักเตะของทีมเดียว เรียงตามเบอร์เสื้อ */
export async function listTeamPlayers(teamId: string) {
  return db.player.findMany({
    where: { teamId, active: true },
    orderBy: [{ number: "asc" }],
    select: { id: true, name: true, slug: true, number: true, position: true, nationality: true },
  });
}

/** ผู้เล่นของสองทีมที่ลงแข่ง ใช้ในฟอร์มบันทึกเหตุการณ์ */
export async function listMatchSquads(homeTeamId: string, awayTeamId: string) {
  return db.player.findMany({
    where: { teamId: { in: [homeTeamId, awayTeamId] }, active: true },
    orderBy: [{ number: "asc" }],
    select: { id: true, name: true, number: true, teamId: true },
  });
}

/** นักเตะทั้งหมดสำหรับหน้าจัดการ (รวมคนที่ปิดใช้งานแล้ว) */
export async function listPlayersForAdmin(
  filters: { teamId?: string; search?: string } = {},
  take = 300,
) {
  return db.player.findMany({
    where: {
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.search ? { name: { contains: filters.search } } : {}),
    },
    orderBy: [{ team: { name: "asc" } }, { number: "asc" }],
    include: { team: { select: { name: true, shortName: true, logoUrl: true, color: true, color2: true } } },
    take,
  });
}

/** เหตุการณ์ทั้งหมดที่นักเตะคนนี้เกี่ยวข้องในฤดูกาล (ทั้งยิงเองและจ่ายให้) */
export async function listPlayerEvents(seasonId: string, playerId: string) {
  return db.matchEvent.findMany({
    where: {
      match: { seasonId, status: "FINISHED" },
      OR: [{ playerId }, { assistPlayerId: playerId }],
    },
    orderBy: { match: { kickoffAt: "desc" } },
    select: {
      id: true, type: true, minute: true, extraMinute: true,
      playerId: true, assistPlayerId: true,
      match: {
        select: {
          id: true, round: true, kickoffAt: true, homeGoals: true, awayGoals: true,
          homeTeam: { select: { shortName: true } },
          awayTeam: { select: { shortName: true } },
        },
      },
    },
  });
}
