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
  livePhase: true,
  phaseStartedAt: true,
  season: { select: { halfMinutes: true } },
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

/** นัดที่ทั้งหมดของฤดูกาล — ตัวเลือกใน RoundPicker (ไม่ใส่วันที่ เพราะแต่ละคู่ในนัดเดียวกันแข่งคนละวันได้) */
export async function listRoundOptions(seasonId: string) {
  const rows = await db.match.findMany({
    where: { seasonId },
    select: { round: true },
    distinct: ["round"],
    orderBy: { round: "asc" },
  });
  return rows.map((r) => ({ round: r.round, label: `นัดที่ ${r.round}` }));
}

export async function getTeamMatches(seasonId: string, teamId: string) {
  return db.match.findMany({
    where: { seasonId, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: matchListSelect,
    orderBy: { kickoffAt: "asc" },
  });
}

/** นัดที่บัญชีนี้อยู่ในทีมผู้ตัดสิน (ช่องใดช่องหนึ่งใน 4 ช่อง) */
export function officiatedBy(userId: string) {
  return {
    OR: [
      { referee: { userId } },
      { assistant1: { userId } },
      { assistant2: { userId } },
      { fourthOfficial: { userId } },
    ],
  };
}

const officialName = { select: { id: true, name: true } } as const;
const officialWithUser = { select: { id: true, name: true, userId: true } } as const;

/** รายละเอียดนัดสำหรับหน้าสาธารณะ — พร้อมไทม์ไลน์เหตุการณ์ */
export async function getMatchDetail(id: string) {
  return db.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { select: { name: true, halfMinutes: true } },
      referee: officialName,
      assistant1: officialName,
      assistant2: officialName,
      fourthOfficial: officialName,
      events: {
        orderBy: [{ minute: "asc" }, { createdAt: "asc" }],
        include: {
          player: { select: { name: true, slug: true } },
          assistPlayer: { select: { name: true, slug: true } },
          issuedBy: { select: { name: true } },
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
      season: { select: { halfMinutes: true } },
      // userId ใช้ตัดสินสิทธิ์ (matchPermission) ว่าบัญชีที่ล็อกอินอยู่ในทีมผู้ตัดสินไหม
      referee: officialWithUser,
      assistant1: officialWithUser,
      assistant2: officialWithUser,
      fourthOfficial: officialWithUser,
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      events: {
        orderBy: [{ minute: "asc" }, { createdAt: "asc" }],
        include: {
          player: { select: { name: true } },
          assistPlayer: { select: { name: true } },
          team: { select: { shortName: true } },
          issuedBy: { select: { name: true } },
        },
      },
    },
  });
}

/** รายการนัดในหน้าบันทึกผล พร้อมตัวกรอง */
export async function listMatchesForAdmin(
  seasonId: string,
  filters: { status?: MatchStatus; round?: number; officialUserId?: string } = {},
) {
  return db.match.findMany({
    where: {
      seasonId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.round ? { round: filters.round } : {}),
      ...(filters.officialUserId ? officiatedBy(filters.officialUserId) : {}),
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

/** นัดที่ยังไม่แข่ง (กรองเฉพาะนัดที่บัญชีหนึ่งอยู่ในทีมผู้ตัดสินได้) */
export async function listUpcomingMatches(
  seasonId: string,
  options: { officialUserId?: string; take?: number } = {},
) {
  return db.match.findMany({
    where: {
      seasonId,
      status: { in: ["SCHEDULED", "LIVE"] },
      ...(options.officialUserId ? officiatedBy(options.officialUserId) : {}),
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

/**
 * สถานะถ่ายทอดสดของฤดูกาล — ใช้ตัดสินว่าหน้าเว็บควรดึงข้อมูลใหม่บ่อยแค่ไหน
 * live = มีนัดกำลังแข่ง · soon = มีนัดใกล้เตะ (อีกไม่เกิน 2 ชม.) หรือเลยเวลาเตะแล้วแต่ยังไม่เริ่มถ่ายทอด
 */
export async function getLiveState(seasonId: string) {
  const now = Date.now();
  const [live, soon] = await Promise.all([
    db.match.count({ where: { seasonId, status: "LIVE" } }),
    db.match.count({
      where: {
        seasonId,
        status: "SCHEDULED",
        kickoffAt: { gte: new Date(now - 3 * 60 * 60 * 1000), lte: new Date(now + 2 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return { live: live > 0, soon: soon > 0 };
}

/** นัดที่กำลังแข่งอยู่ตอนนี้ — การ์ด "กำลังแข่ง" บนหน้าแรก */
export async function listLiveMatches(seasonId: string) {
  return db.match.findMany({
    where: { seasonId, status: "LIVE" },
    select: matchListSelect,
    orderBy: { kickoffAt: "asc" },
  });
}
