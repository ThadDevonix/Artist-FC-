import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeStandings, parseTiebreakers, type StandingTeam } from "../src/lib/standings";
import { generateRoundRobin, fixtureSummary } from "../src/lib/fixtures";
import { readClock, readStopwatch } from "../src/lib/live-clock";
import { cupSummary, firstRoundSeeds, knockoutFixtures, tieWinner } from "../src/lib/knockout";

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
    ({ period, onBreak, startedAt: t0, periods, periodMinutes, extraMinutes: 15 });
  const clockCases: [string, string | null, string][] = [
    ["2 ครึ่ง × 45 ครึ่งแรก", readClock(clock(1, 2, 45), at).label, "6'"],
    ["2 ครึ่ง × 45 ครึ่งหลัง", readClock(clock(2, 2, 45), at).label, "51'"],
    ["2 ครึ่ง พักครึ่ง", readClock(clock(1, 2, 45, true), at).label, "พักครึ่ง"],
    ["4 ควอเตอร์ × 12 ควอเตอร์ที่ 3", readClock(clock(3, 4, 12), at).label, "30'"],
    ["4 ควอเตอร์ × 5 ทดเวลา", readClock(clock(4, 4, 5), at).label, "20+1'"],
    ["4 ควอเตอร์ พักหลัง Q2", readClock(clock(2, 4, 12, true), at).label, "พักหลังควอเตอร์ที่ 2"],
    ["นาฬิกาจับเวลา ควอเตอร์ที่ 3", readStopwatch(clock(3, 4, 12), at), "29:30"],
    ["ต่อเวลาครึ่งแรก (2 × 45 + 15)", readClock(clock(3, 2, 45), at).label, "96'"],
    ["ต่อเวลาครึ่งหลัง", readClock(clock(4, 2, 45), at).label, "111'"],
    ["พักก่อนต่อเวลา", readClock(clock(2, 2, 45, true), at).label, "พักก่อนต่อเวลา"],
    ["นาฬิกาจับเวลา ต่อเวลาครึ่งหลัง", readStopwatch(clock(4, 2, 45), at), "110:30"],
  ];
  for (const [label, got, want] of clockCases) {
    console.log(`นาฬิกา ${label}: ${got} ${got === want ? "✓" : `✗ (ควรเป็น ${want})`}`);
    if (got !== want) process.exitCode = 1;
  }

  // ตรวจแบ่งกลุ่ม + น็อคเอาต์
  const cup = (label: string, got: unknown, want: unknown) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`น็อคเอาต์ ${label}: ${ok ? "✓" : `✗ ได้ ${JSON.stringify(got)} ควรเป็น ${JSON.stringify(want)}`}`);
    if (!ok) process.exitCode = 1;
  };
  const s44 = cupSummary({ groupCount: 4, groupSize: 4, advancePerGroup: 2, rounds: 1, knockoutLegs: 1 });
  cup("4 กลุ่ม × 4 ทีม ผ่าน 2", s44.ok && [s44.teams, s44.groupMatches, s44.groupRounds, s44.koSizes, s44.koMatches], [16, 24, 3, [8, 4, 2], 7]);
  const s2leg = cupSummary({ groupCount: 4, groupSize: 4, advancePerGroup: 2, rounds: 2, knockoutLegs: 2 });
  cup("เหย้า-เยือน (นัดชิงนัดเดียว)", s2leg.ok && [s2leg.groupMatches, s2leg.koMatches], [48, 13]);
  cup("3 กลุ่ม ผ่าน 2 = 6 ทีม → จัดสายไม่ได้", cupSummary({ groupCount: 3, groupSize: 4, advancePerGroup: 2, rounds: 1, knockoutLegs: 1 }).ok, false);
  cup("ไขว้สาย 4 กลุ่ม", firstRoundSeeds(4, 2), [["G:1:1", "G:2:2"], ["G:3:1", "G:4:2"], ["G:2:1", "G:1:2"], ["G:4:1", "G:3:2"]]);
  cup("กลุ่มเดียว ผ่าน 4 → 1–4, 2–3", firstRoundSeeds(1, 4), [["G:1:1", "G:1:4"], ["G:1:2", "G:1:3"]]);
  const ko = knockoutFixtures({ groupCount: 2, advancePerGroup: 2, knockoutLegs: 2 }, 4);
  cup("รองฯ เหย้า-เยือน + นัดชิง", ko.map((f) => `${f.round}:${f.koSize}/${f.koSlot}/${f.leg ?? "-"} ${f.homeSource}-${f.awaySource}`), [
    "4:4/1/1 G:1:1-G:2:2", "5:4/1/2 G:2:2-G:1:1", "4:4/2/1 G:2:1-G:1:2", "5:4/2/2 G:1:2-G:2:1", "6:2/1/- W:4:1-W:4:2",
  ]);
  const leg = (h: string, a: string, hg: number, ag: number, n: number | null, hp: number | null = null, ap: number | null = null) =>
    ({ homeTeamId: h, awayTeamId: a, homeGoals: hg, awayGoals: ag, homePens: hp, awayPens: ap, status: "FINISHED", leg: n });
  cup("ชนะนัดเดียว", tieWinner([leg("x", "y", 2, 1, null)]), "x");
  cup("รวมสองนัด 3–2", tieWinner([leg("x", "y", 2, 0, 1), leg("y", "x", 2, 1, 2)]), "x");
  cup("รวมเสมอ → จุดโทษนัดสอง", tieWinner([leg("x", "y", 1, 0, 1), leg("y", "x", 1, 0, 2, 5, 4)]), "y");
  cup("เสมอไม่มีจุดโทษ = ยังไม่รู้ผล", tieWinner([leg("x", "y", 1, 1, null)]), null);
  await db.$disconnect();
}
main();
