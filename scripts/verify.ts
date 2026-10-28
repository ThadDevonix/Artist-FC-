import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeStandings, parseTiebreakers, type StandingTeam } from "../src/lib/standings";
import { generateRoundRobin, fixtureSummary } from "../src/lib/fixtures";
import { readClock, readStopwatch } from "../src/lib/live-clock";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const season = (await db.season.findFirst({ where: { isActive: true } }))!;
  const teams = (await db.seasonTeam.findMany({
    where: { seasonId: season.id },
    select: { team: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, color: true, color2: true } } },
  })).map((s: { team: StandingTeam }) => s.team);
  const ms = await db.match.findMany({ where: { seasonId: season.id, status: "FINISHED" } });

  const rows = computeStandings(teams, ms.map((m) => ({
    id: m.id, round: m.round, kickoffAt: m.kickoffAt,
    homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
    homeGoals: m.homeGoals!, awayGoals: m.awayGoals!,
  })), { points: { win: season.pointsWin, draw: season.pointsDraw, loss: season.pointsLoss }, tiebreakers: parseTiebreakers(season.tiebreakers) });

  console.log("อันดับ  ทีม             แข่ง ช ส พ  ได้ เสีย ต่าง แต้ม  ฟอร์ม");
  for (const r of rows) {
    console.log(
      String(r.position).padStart(4),
      r.team.shortName.padEnd(12),
      String(r.played).padStart(3), String(r.won).padStart(2), String(r.drawn).padStart(2), String(r.lost).padStart(2),
      String(r.goalsFor).padStart(3), String(r.goalsAgainst).padStart(4), String(r.goalDiff).padStart(4), String(r.points).padStart(4),
      " ", r.form.map((f) => f.result).join(""),
    );
  }

  // ตรวจความสอดคล้อง
  const totalPlayed = rows.reduce((s, r) => s + r.played, 0);
  const gf = rows.reduce((s, r) => s + r.goalsFor, 0);
  const ga = rows.reduce((s, r) => s + r.goalsAgainst, 0);
  const gd = rows.reduce((s, r) => s + r.goalDiff, 0);
  console.log(`\nตรวจสอบ: นัดที่นับ ${totalPlayed / 2} (ควรเท่า ${ms.length}) | ได้รวม ${gf} = เสียรวม ${ga} | ผลต่างรวม ${gd} (ควรเป็น 0)`);

  // ตรวจ fixture generator
  for (const n of [4, 5, 10, 11, 20]) {
    const pairs = generateRoundRobin(Array.from({ length: n }, (_, i) => `t${i}`), { rounds: 1 });
    const s = fixtureSummary(n, 1);
    const seen = new Set(pairs.map((p) => [p.homeTeamId, p.awayTeamId].sort().join("|")));
    const perRound = new Map<number, Set<string>>();
    let clash = false;
    for (const p of pairs) {
      const set = perRound.get(p.round) ?? new Set();
      if (set.has(p.homeTeamId) || set.has(p.awayTeamId)) clash = true;
      set.add(p.homeTeamId); set.add(p.awayTeamId);
      perRound.set(p.round, set);
    }
    console.log(`${n} ทีม → ${pairs.length} นัด (คาด ${s.totalMatches}) | คู่ไม่ซ้ำ ${seen.size} | ชนกันในนัดเดียว: ${clash ? "มี ✗" : "ไม่มี ✓"}`);
  }

  // ตรวจนาฬิกาถ่ายทอดสดตามจำนวนช่วงของฤดูกาล — เริ่มช่วงมาแล้ว 5 นาที 30 วินาที
  const t0 = new Date("2026-01-01T00:00:00Z");
  const at = t0.getTime() + 5.5 * 60_000;
  const clock = (period: number, periods: number, periodMinutes: number, onBreak = false) =>
    ({ period, onBreak, startedAt: t0, periods, periodMinutes });
  const clockCases: [string, string | null, string][] = [
    ["2 ครึ่ง × 45 ครึ่งแรก", readClock(clock(1, 2, 45), at).label, "6'"],
    ["2 ครึ่ง × 45 ครึ่งหลัง", readClock(clock(2, 2, 45), at).label, "51'"],
    ["2 ครึ่ง พักครึ่ง", readClock(clock(1, 2, 45, true), at).label, "พักครึ่ง"],
    ["4 ควอเตอร์ × 12 ควอเตอร์ที่ 3", readClock(clock(3, 4, 12), at).label, "30'"],
    ["4 ควอเตอร์ × 5 ทดเวลา", readClock(clock(4, 4, 5), at).label, "20+1'"],
    ["4 ควอเตอร์ พักหลัง Q2", readClock(clock(2, 4, 12, true), at).label, "พักหลังควอเตอร์ที่ 2"],
    ["นาฬิกาจับเวลา ควอเตอร์ที่ 3", readStopwatch(clock(3, 4, 12), at), "29:30"],
  ];
  for (const [label, got, want] of clockCases) {
    console.log(`นาฬิกา ${label}: ${got} ${got === want ? "✓" : `✗ (ควรเป็น ${want})`}`);
    if (got !== want) process.exitCode = 1;
  }
  await db.$disconnect();
}
main();
