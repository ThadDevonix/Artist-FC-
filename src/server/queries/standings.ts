import "server-only";
import { db } from "@/server/db";
import { computeStandings, parseTiebreakers, type StandingRow } from "@/lib/standings";

export type StandingZone = { label: string; color: string; fromPos: number; toPos: number };

/**
 * ตารางคะแนนของฤดูกาล พร้อมโซนสี
 *
 * ตัวคำนวณจริงอยู่ที่ src/lib/standings.ts ซึ่งไม่รู้จักฐานข้อมูลเลย
 * ที่นี่ทำหน้าที่แค่ดึงข้อมูลแล้วส่งต่อ — แยกแบบนี้ทำให้เทสต์กฎคะแนนได้โดยไม่ต้องมี DB
 */
export async function getStandings(seasonId: string): Promise<{
  rows: StandingRow[];
  zones: StandingZone[];
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
      where: { seasonId, status: "FINISHED" },
      select: {
        id: true, round: true, kickoffAt: true,
        homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true,
      },
      orderBy: { kickoffAt: "asc" },
    }),
    db.zone.findMany({ where: { seasonId }, orderBy: { fromPos: "asc" } }),
  ]);

  if (!season) return { rows: [], zones: [] };

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
  };
}
