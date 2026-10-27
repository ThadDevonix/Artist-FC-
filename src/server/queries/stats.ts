import { db } from "@/server/db";
import type { EventType } from "@/generated/prisma/enums";

export type LeaderRow = {
  playerId: string;
  name: string;
  slug: string;
  photoUrl: string | null;
  teamName: string | null;
  teamSlug: string | null;
  teamLogo: string | null;
  teamColor: string | null;
  teamColor2: string | null;
  value: number;
};

export type LeaderBoard = "goals" | "assists" | "yellow" | "red";

export const LEADER_LABELS: Record<LeaderBoard, string> = {
  goals: "ประตู",
  assists: "จ่ายบอล",
  yellow: "ใบเหลือง",
  red: "ใบแดง",
};

const GOAL_TYPES: EventType[] = ["GOAL", "PENALTY_GOAL"];

/**
 * ตารางผู้นำสถิติของฤดูกาล
 * นับเฉพาะเหตุการณ์จากนัดที่อนุมัติแล้ว (FINISHED)
 * หมายเหตุ: ไม่นับ OWN_GOAL ให้ผู้ทำเข้าประตูตัวเอง ตามธรรมเนียมการนับดาวซัลโว
 */
export async function getLeaders(
  seasonId: string,
  board: LeaderBoard,
  limit = 10,
): Promise<LeaderRow[]> {
  const where = {
    match: { seasonId, status: "FINISHED" as const },
    ...(board === "assists"
      ? { assistPlayerId: { not: null }, type: { in: GOAL_TYPES } }
      : board === "goals"
        ? { type: { in: GOAL_TYPES }, playerId: { not: null } }
        : board === "yellow"
          ? { type: { in: ["YELLOW", "SECOND_YELLOW"] as EventType[] }, playerId: { not: null } }
          : { type: "RED" as EventType, playerId: { not: null } }),
  };

  const events = await db.matchEvent.findMany({
    where,
    select: {
      playerId: true,
      assistPlayerId: true,
      player: { select: { id: true, name: true, slug: true, photoUrl: true, team: { select: { shortName: true, slug: true, logoUrl: true, color: true, color2: true } } } },
      assistPlayer: { select: { id: true, name: true, slug: true, photoUrl: true, team: { select: { shortName: true, slug: true, logoUrl: true, color: true, color2: true } } } },
    },
  });

  const tally = new Map<string, LeaderRow>();
  for (const e of events) {
    const p = board === "assists" ? e.assistPlayer : e.player;
    if (!p) continue;
    const row = tally.get(p.id) ?? {
      playerId: p.id,
      name: p.name,
      slug: p.slug,
      photoUrl: p.photoUrl,
      teamName: p.team?.shortName ?? null,
      teamSlug: p.team?.slug ?? null,
      teamLogo: p.team?.logoUrl ?? null,
      teamColor: p.team?.color ?? null,
      teamColor2: p.team?.color2 ?? null,
      value: 0,
    };
    row.value++;
    tally.set(p.id, row);
  }

  return [...tally.values()]
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "th"))
    .slice(0, limit);
}

/** สถิติรวมรายนักเตะในฤดูกาล ใช้ในหน้าโปรไฟล์และตารางสถิติแบบเต็ม */
export async function getPlayerSeasonStats(seasonId: string) {
  const events = await db.matchEvent.findMany({
    where: { match: { seasonId, status: "FINISHED" } },
    select: { type: true, playerId: true, assistPlayerId: true },
  });

  const stats = new Map<
    string,
    { goals: number; assists: number; yellow: number; red: number }
  >();
  const bump = (id: string | null, key: "goals" | "assists" | "yellow" | "red") => {
    if (!id) return;
    const s = stats.get(id) ?? { goals: 0, assists: 0, yellow: 0, red: 0 };
    s[key]++;
    stats.set(id, s);
  };

  for (const e of events) {
    if (e.type === "GOAL" || e.type === "PENALTY_GOAL") {
      bump(e.playerId, "goals");
      bump(e.assistPlayerId, "assists");
    } else if (e.type === "YELLOW" || e.type === "SECOND_YELLOW") {
      bump(e.playerId, "yellow");
    } else if (e.type === "RED") {
      bump(e.playerId, "red");
    }
  }

  return stats;
}

/** จำนวนนัดที่ทีมลงเล่นไปแล้ว ใช้คำนวณ "นัดที่ X จาก Y" */
export async function getSeasonProgress(seasonId: string) {
  const [played, total] = await Promise.all([
    db.match.count({ where: { seasonId, status: "FINISHED" } }),
    db.match.count({ where: { seasonId } }),
  ]);
  const rounds = await db.match.aggregate({
    where: { seasonId },
    _max: { round: true },
  });
  const currentRound = await db.match.aggregate({
    where: { seasonId, status: "FINISHED" },
    _max: { round: true },
  });
  return {
    playedMatches: played,
    totalMatches: total,
    totalRounds: rounds._max.round ?? 0,
    currentRound: currentRound._max.round ?? 0,
  };
}

/** นับนัดที่ทีมไม่เสียประตูเลย จากนัดที่อนุมัติแล้ว */
export async function getCleanSheets(seasonId: string) {
  const [matches, teams] = await Promise.all([
    db.match.findMany({
      where: { seasonId, status: "FINISHED" },
      select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
    }),
    db.team.findMany({
      where: { seasons: { some: { seasonId } } },
      select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, color: true, color2: true },
    }),
  ]);

  const count = new Map<string, number>();
  for (const m of matches) {
    if (m.awayGoals === 0) count.set(m.homeTeamId, (count.get(m.homeTeamId) ?? 0) + 1);
    if (m.homeGoals === 0) count.set(m.awayTeamId, (count.get(m.awayTeamId) ?? 0) + 1);
  }

  return teams
    .map((team) => ({ team, value: count.get(team.id) ?? 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}
