import "server-only";
import { db } from "@/server/db";
import { LOCKED_STATUSES, UPCOMING_STATUSES } from "@/lib/labels";
import type { MatchStatus } from "@/generated/prisma/enums";

/** ฟิลด์ชุดเดียวที่ทุกหน้าใช้แสดงรายการนัด — แก้ที่นี่ที่เดียวแล้วเปลี่ยนทุกหน้า */
export const matchListSelect = {
  id: true,
  round: true,
  kickoffAt: true,
  venue: true,
  status: true,
  homeGoals: true,
  awayGoals: true,
  homeTeam: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, color: true, color2: true } },
  awayTeam: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, color: true, color2: true } },
} as const;

export async function getMatchesByRound(seasonId: string, round?: number) {
  return db.match.findMany({
    where: { seasonId, ...(round ? { round } : {}) },
    select: matchListSelect,
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }],
  });
}

export async function getRecentAndUpcoming(seasonId: string, take = 5) {
  const [recent, upcoming] = await Promise.all([
    db.match.findMany({
      where: { seasonId, status: "FINISHED" },
      select: matchListSelect,
      orderBy: { kickoffAt: "desc" },
      take,
    }),
    db.match.findMany({
      where: { seasonId, status: { in: UPCOMING_STATUSES } },
      select: matchListSelect,
      orderBy: { kickoffAt: "asc" },
      take,
    }),
  ]);
  return { recent, upcoming };
}

export async function listRounds(seasonId: string) {
  const rows = await db.match.findMany({
    where: { seasonId },
    select: { round: true },
    distinct: ["round"],
    orderBy: { round: "asc" },
  });
  return rows.map((r) => r.round);
}

export async function getTeamMatches(seasonId: string, teamId: string) {
  return db.match.findMany({
    where: { seasonId, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: matchListSelect,
    orderBy: { kickoffAt: "asc" },
  });
}

/** รายละเอียดนัดสำหรับหน้าสาธารณะ — พร้อมไทม์ไลน์เหตุการณ์ */
export async function getMatchDetail(id: string) {
  return db.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { select: { name: true } },
      referee: { select: { name: true } },
      events: {
        orderBy: [{ minute: "asc" }, { createdAt: "asc" }],
        include: {
          player: { select: { name: true, slug: true } },
          assistPlayer: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

/** รายละเอียดนัดสำหรับหลังบ้าน — เพิ่มข้อมูลผู้ส่ง/ผู้อนุมัติ */
export async function getMatchForAdmin(id: string) {
  return db.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      referee: { select: { id: true, name: true } },
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      events: {
        orderBy: [{ minute: "asc" }, { createdAt: "asc" }],
        include: {
          player: { select: { name: true } },
          assistPlayer: { select: { name: true } },
          team: { select: { shortName: true } },
        },
      },
    },
  });
}

/** รายการนัดในหน้าบันทึกผล พร้อมตัวกรอง */
export async function listMatchesForAdmin(
  seasonId: string,
  filters: { status?: MatchStatus; round?: number; refereeId?: string } = {},
) {
  return db.match.findMany({
    where: {
      seasonId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.round ? { round: filters.round } : {}),
      ...(filters.refereeId ? { refereeId: filters.refereeId } : {}),
    },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }],
    include: {
      homeTeam: { select: { name: true, shortName: true, logoUrl: true, color: true, color2: true } },
      awayTeam: { select: { name: true, shortName: true, logoUrl: true, color: true, color2: true } },
      referee: { select: { name: true } },
    },
  });
}

/** นัดในหน้าโปรแกรมแข่ง พร้อมตัวกรองของหน้าเว็บ */
export async function listMatchesForFixtures(
  seasonId: string,
  filters: { round?: number; status?: MatchStatus; upcoming?: boolean; newestFirst?: boolean } = {},
) {
  return db.match.findMany({
    where: {
      seasonId,
      ...(filters.round ? { round: filters.round } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.upcoming ? { status: { in: UPCOMING_STATUSES } } : {}),
    },
    select: matchListSelect,
    orderBy: filters.newestFirst
      ? [{ kickoffAt: "desc" }]
      : [{ round: "asc" }, { kickoffAt: "asc" }],
  });
}

/** นัดที่รออนุมัติ — หน้าแรกของหลังบ้าน */
export async function listPendingMatches(seasonId: string, take = 8) {
  return db.match.findMany({
    where: { seasonId, status: "PENDING" },
    orderBy: { submittedAt: "desc" },
    take,
    include: {
      homeTeam: { select: { name: true, shortName: true, logoUrl: true, color: true, color2: true } },
      awayTeam: { select: { name: true, shortName: true, logoUrl: true, color: true, color2: true } },
      submittedBy: { select: { name: true } },
    },
  });
}

/** นัดที่ยังไม่แข่ง (กรองเฉพาะของผู้ตัดสินคนหนึ่งได้) */
export async function listUpcomingMatches(
  seasonId: string,
  options: { refereeId?: string; take?: number } = {},
) {
  return db.match.findMany({
    where: {
      seasonId,
      status: { in: ["SCHEDULED", "LIVE"] },
      ...(options.refereeId ? { refereeId: options.refereeId } : {}),
    },
    orderBy: { kickoffAt: "asc" },
    take: options.take ?? 8,
    include: {
      homeTeam: { select: { name: true, shortName: true, logoUrl: true, color: true, color2: true } },
      awayTeam: { select: { name: true, shortName: true, logoUrl: true, color: true, color2: true } },
    },
  });
}

/** ตัวเลขสรุปของฤดูกาล ใช้บนหน้าแรกหลังบ้านและหน้าตั้งค่า */
export async function getSeasonMatchCounts(seasonId: string) {
  const [total, finished, pending, locked] = await Promise.all([
    db.match.count({ where: { seasonId } }),
    db.match.count({ where: { seasonId, status: "FINISHED" } }),
    db.match.count({ where: { seasonId, status: "PENDING" } }),
    db.match.count({ where: { seasonId, status: { in: LOCKED_STATUSES } } }),
  ]);
  return { total, finished, pending, locked };
}
