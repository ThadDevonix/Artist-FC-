/**
 * คำนวณตารางคะแนนจากผลการแข่งขัน
 *
 * นับเฉพาะนัดที่สถานะ FINISHED เท่านั้น (นัดที่กรรมการส่งผลแล้วแต่แอดมินยังไม่อนุมัติ
 * จะยังไม่ถูกนับ) ลำดับการตัดสินเมื่อคะแนนเท่ากันกำหนดได้ต่อฤดูกาล
 */

export type Tiebreaker =
  | "GOAL_DIFF" // ผลต่างประตู
  | "GOALS_FOR" // ประตูได้
  | "HEAD_TO_HEAD" // ผลการเจอกันเอง
  | "WINS" // จำนวนนัดที่ชนะ
  | "GOALS_AGAINST" // เสียประตูน้อยกว่า
  | "AWAY_GOALS" // ประตูที่ยิงได้ในเกมเยือน
  | "NAME"; // เรียงตามชื่อ (กันกรณีเท่ากันหมด)

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  GOAL_DIFF: "ผลต่างประตู",
  GOALS_FOR: "ประตูได้",
  HEAD_TO_HEAD: "ผลการเจอกันเอง",
  WINS: "จำนวนนัดที่ชนะ",
  GOALS_AGAINST: "เสียประตูน้อยกว่า",
  AWAY_GOALS: "ประตูในเกมเยือน",
  NAME: "ชื่อสโมสร",
};

export const DEFAULT_TIEBREAKERS: Tiebreaker[] = [
  "GOAL_DIFF",
  "GOALS_FOR",
  "HEAD_TO_HEAD",
  "WINS",
  "NAME",
];

export type FormResult = "W" | "D" | "L";

export type StandingMatch = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  kickoffAt: Date;
  round: number;
};

export type StandingTeam = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  color: string;
  color2: string | null;
};

export type StandingRow = {
  position: number;
  team: StandingTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** ฟอร์ม 5 นัดล่าสุด เรียงจากเก่าไปใหม่ */
  form: { result: FormResult; matchId: string }[];
  homeRecord: { played: number; won: number; drawn: number; lost: number };
  awayRecord: { played: number; won: number; drawn: number; lost: number };
};

export type PointsRule = { win: number; draw: number; loss: number };

export const DEFAULT_POINTS: PointsRule = { win: 3, draw: 1, loss: 0 };

export function computeStandings(
  teams: StandingTeam[],
  matches: StandingMatch[],
  opts: { points?: PointsRule; tiebreakers?: Tiebreaker[]; formLength?: number } = {},
): StandingRow[] {
  const points = opts.points ?? DEFAULT_POINTS;
  const tiebreakers = opts.tiebreakers?.length ? opts.tiebreakers : DEFAULT_TIEBREAKERS;
  const formLength = opts.formLength ?? 5;

  const blank = () => ({ played: 0, won: 0, drawn: 0, lost: 0 });
  const table = new Map<string, StandingRow>();
  // ประตูที่ยิงได้ในเกมเยือน เก็บแยกเพราะใช้เฉพาะตอนตัดสินอันดับ ไม่ได้แสดงในตาราง
  const awayGoalsFor = new Map<string, number>();

  for (const team of teams) {
    table.set(team.id, {
      position: 0,
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      form: [],
      homeRecord: blank(),
      awayRecord: blank(),
    });
    awayGoalsFor.set(team.id, 0);
  }

  // เรียงตามเวลาแข่ง เพื่อให้ฟอร์ม 5 นัดล่าสุดถูกลำดับ
  const ordered = [...matches].sort(
    (a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime() || a.round - b.round,
  );

  for (const m of ordered) {
    const home = table.get(m.homeTeamId);
    const away = table.get(m.awayTeamId);
    if (!home || !away) continue; // ทีมที่ไม่ได้อยู่ในฤดูกาลนี้

    home.played++;
    away.played++;
    home.homeRecord.played++;
    away.awayRecord.played++;

    home.goalsFor += m.homeGoals;
    home.goalsAgainst += m.awayGoals;
    away.goalsFor += m.awayGoals;
    away.goalsAgainst += m.homeGoals;
    awayGoalsFor.set(m.awayTeamId, (awayGoalsFor.get(m.awayTeamId) ?? 0) + m.awayGoals);

    if (m.homeGoals > m.awayGoals) {
      home.won++; home.homeRecord.won++; home.points += points.win;
      away.lost++; away.awayRecord.lost++; away.points += points.loss;
      home.form.push({ result: "W", matchId: m.id });
      away.form.push({ result: "L", matchId: m.id });
    } else if (m.homeGoals < m.awayGoals) {
      away.won++; away.awayRecord.won++; away.points += points.win;
      home.lost++; home.homeRecord.lost++; home.points += points.loss;
      away.form.push({ result: "W", matchId: m.id });
      home.form.push({ result: "L", matchId: m.id });
    } else {
      home.drawn++; home.homeRecord.drawn++; home.points += points.draw;
      away.drawn++; away.awayRecord.drawn++; away.points += points.draw;
      home.form.push({ result: "D", matchId: m.id });
      away.form.push({ result: "D", matchId: m.id });
    }
  }

  const rows = [...table.values()];
  for (const row of rows) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-formLength);
  }

  const ctx: SortContext = { matches: ordered, points, awayGoalsFor };
  rows.sort((a, b) => compareRows(a, b, tiebreakers, ctx));
  rows.forEach((row, i) => (row.position = i + 1));

  return rows;
}

type SortContext = {
  matches: StandingMatch[];
  points: PointsRule;
  awayGoalsFor: Map<string, number>;
};

function compareRows(
  a: StandingRow,
  b: StandingRow,
  tiebreakers: Tiebreaker[],
  ctx: SortContext,
): number {
  if (b.points !== a.points) return b.points - a.points;

  for (const rule of tiebreakers) {
    const diff = applyTiebreaker(rule, a, b, ctx);
    if (diff !== 0) return diff;
  }
  return a.team.name.localeCompare(b.team.name, "th");
}

function applyTiebreaker(
  rule: Tiebreaker,
  a: StandingRow,
  b: StandingRow,
  ctx: SortContext,
): number {
  switch (rule) {
    case "GOAL_DIFF":
      return b.goalDiff - a.goalDiff;
    case "GOALS_FOR":
      return b.goalsFor - a.goalsFor;
    case "GOALS_AGAINST":
      return a.goalsAgainst - b.goalsAgainst;
    case "WINS":
      return b.won - a.won;
    case "AWAY_GOALS":
      return (ctx.awayGoalsFor.get(b.team.id) ?? 0) - (ctx.awayGoalsFor.get(a.team.id) ?? 0);
    case "HEAD_TO_HEAD":
      return headToHead(a.team.id, b.team.id, ctx.matches, ctx.points);
    case "NAME":
      return a.team.name.localeCompare(b.team.name, "th");
    default:
      return 0;
  }
}

/** เทียบผลการเจอกันเองของสองทีม: คะแนนก่อน แล้วค่อยผลต่างประตูในนัดที่เจอกัน */
function headToHead(
  teamA: string,
  teamB: string,
  matches: StandingMatch[],
  points: PointsRule,
): number {
  let ptsA = 0, ptsB = 0, gfA = 0, gfB = 0;

  for (const m of matches) {
    const isPair =
      (m.homeTeamId === teamA && m.awayTeamId === teamB) ||
      (m.homeTeamId === teamB && m.awayTeamId === teamA);
    if (!isPair) continue;

    const aIsHome = m.homeTeamId === teamA;
    const goalsA = aIsHome ? m.homeGoals : m.awayGoals;
    const goalsB = aIsHome ? m.awayGoals : m.homeGoals;

    gfA += goalsA;
    gfB += goalsB;

    if (goalsA > goalsB) { ptsA += points.win; ptsB += points.loss; }
    else if (goalsA < goalsB) { ptsB += points.win; ptsA += points.loss; }
    else { ptsA += points.draw; ptsB += points.draw; }
  }

  if (ptsA !== ptsB) return ptsB - ptsA;
  return gfB - gfA;
}

/** อ่านค่า tiebreakers ที่เก็บเป็น JSON string ในตาราง Season */
export function parseTiebreakers(raw: string | null | undefined): Tiebreaker[] {
  if (!raw) return DEFAULT_TIEBREAKERS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TIEBREAKERS;
    const valid = parsed.filter(
      (x): x is Tiebreaker => typeof x === "string" && x in TIEBREAKER_LABELS,
    );
    return valid.length ? valid : DEFAULT_TIEBREAKERS;
  } catch {
    return DEFAULT_TIEBREAKERS;
  }
}
