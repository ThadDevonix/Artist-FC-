import "server-only";
import { db } from "@/server/db";
import { computeStandings, parseTiebreakers, type StandingRow } from "@/lib/standings";
import { groupLetter } from "@/lib/knockout";
import { groupTables } from "@/server/bracket";

export type StandingZone = { label: string; color: string; fromPos: number; toPos: number };

/** ตารางของกลุ่มหนึ่ง (ฤดูกาลแบบแบ่งกลุ่ม) */
export type GroupStanding = { group: number; label: string; rows: StandingRow[]; complete: boolean };

/** แถบสีอัตโนมัติของทีมที่ผ่านเข้ารอบในแต่ละกลุ่ม */
const QUALIFY_COLOR = "#15803d";

/**
 * ตารางคะแนนของฤดูกาล พร้อมโซนสี
 *
 * ตัวคำนวณจริงอยู่ที่ src/lib/standings.ts ซึ่งไม่รู้จักฐานข้อมูลเลย
 * ที่นี่ทำหน้าที่แค่ดึงข้อมูลแล้วส่งต่อ — แยกแบบนี้ทำให้เทสต์กฎคะแนนได้โดยไม่ต้องมี DB
 */
/** ทีมที่กำลังแข่งอยู่ — สกอร์จากมุมของทีมนั้น ใช้แสดงในตารางคะแนนสด */
export type LiveTeamScore = {
  goalsFor: number;
  goalsAgainst: number;
  /** นาฬิกาของนัดนั้น — ใช้แสดงนาทีหลังสกอร์ในตาราง */
  livePeriod: number | null;
  liveBreak: boolean;
  phaseStartedAt: Date | null;
  periods: number;
  periodMinutes: number;
  extraTimeMinutes: number;
};

/**
 * ตารางคะแนนนับนัดที่กำลังแข่งด้วยสกอร์ปัจจุบันเสมอ — ยิงประตูแล้วอันดับขยับทันที
 * พอจบเกมก็กลายเป็นผลจริงไปเอง ไม่ต้องมีตาราง "สด" กับ "ทางการ" แยกกัน
 * includeLive = false ใช้หาอันดับก่อนเกม เพื่อแสดงลูกศร ▲▼ ว่าอันดับขยับจากนัดที่กำลังแข่ง
 */
export async function getStandings(
  seasonId: string,
  { includeLive = true }: { includeLive?: boolean } = {},
): Promise<{
  rows: StandingRow[];
  zones: StandingZone[];
  live: Record<string, LiveTeamScore>;
  /** ฤดูกาลแบบแบ่งกลุ่ม: ตารางแยกกลุ่ม (rows = ทุกกลุ่มต่อกัน อันดับนับในกลุ่ม) · ลีก = [] */
  groups: GroupStanding[];
}> {
  const [season, seasonTeams, matches, zones] = await Promise.all([
    db.season.findUnique({ where: { id: seasonId } }),
    db.seasonTeam.findMany({
      where: { seasonId },
      select: {
        team: {
          select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, color: true, color2: true },
        },
      },
    }),
    db.match.findMany({
      where: { seasonId, status: { in: includeLive ? ["FINISHED", "LIVE"] : ["FINISHED"] } },
      select: {
        id: true, round: true, kickoffAt: true, status: true, livePeriod: true, liveBreak: true, phaseStartedAt: true,
        homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true,
      },
      orderBy: { kickoffAt: "asc" },
    }),
    db.zone.findMany({ where: { seasonId }, orderBy: { fromPos: "asc" } }),
  ]);

  if (!season) return { rows: [], zones: [], live: {}, groups: [] };

  const live: Record<string, LiveTeamScore> = {};
  for (const m of matches) {
    if (m.status !== "LIVE" || m.homeGoals === null || m.awayGoals === null) continue;
    const clock = {
      livePeriod: m.livePeriod, liveBreak: m.liveBreak, phaseStartedAt: m.phaseStartedAt,
      periods: season.periods, periodMinutes: season.periodMinutes, extraTimeMinutes: season.extraTimeMinutes,
    };
    live[m.homeTeamId] = { goalsFor: m.homeGoals, goalsAgainst: m.awayGoals, ...clock };
    live[m.awayTeamId] = { goalsFor: m.awayGoals, goalsAgainst: m.homeGoals, ...clock };
  }

  if (season.format === "CUP") {
    const tables = await groupTables(db, seasonId, includeLive);
    const groups = tables.map((t) => ({ ...t, label: `กลุ่ม ${groupLetter(t.group)}` }));
    return {
      rows: groups.flatMap((g) => g.rows),
      zones: [{ label: "ผ่านเข้ารอบน็อคเอาต์", color: QUALIFY_COLOR, fromPos: 1, toPos: season.advancePerGroup }],
      live,
      groups,
    };
  }

  const rows = computeStandings(
    seasonTeams.map((st) => st.team),
    matches
      .filter((m) => m.homeGoals !== null && m.awayGoals !== null)
      .map((m) => ({
        id: m.id,
        round: m.round,
        kickoffAt: m.kickoffAt,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeGoals: m.homeGoals!,
        awayGoals: m.awayGoals!,
      })),
    {
      points: { win: season.pointsWin, draw: season.pointsDraw, loss: season.pointsLoss },
      tiebreakers: parseTiebreakers(season.tiebreakers),
    },
  );

  return {
    rows,
    zones: zones.map((z) => ({ label: z.label, color: z.color, fromPos: z.fromPos, toPos: z.toPos })),
    live,
    groups: [],
  };
}
