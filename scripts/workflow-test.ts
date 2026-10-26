/**
 * ทดสอบกฎสำคัญของระบบ: ผลที่ยังไม่อนุมัติต้องไม่ถูกนับในตารางคะแนน
 * และเมื่ออนุมัติแล้วคะแนนต้องขยับตามจริง — ทดสอบแล้วคืนค่าเดิมทุกครั้ง
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { computeStandings, parseTiebreakers, type StandingTeam } from "../src/lib/standings";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

async function standingsNow(seasonId: string) {
  const season = await db.season.findUniqueOrThrow({ where: { id: seasonId } });
  const teams = (
    await db.seasonTeam.findMany({
      where: { seasonId },
      select: { team: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, color: true } } },
    })
  ).map((s: { team: StandingTeam }) => s.team);
  const ms = await db.match.findMany({ where: { seasonId, status: "FINISHED" } });
  return computeStandings(
    teams,
    ms.map((m) => ({
      id: m.id, round: m.round, kickoffAt: m.kickoffAt,
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeGoals: m.homeGoals!, awayGoals: m.awayGoals!,
    })),
    {
      points: { win: season.pointsWin, draw: season.pointsDraw, loss: season.pointsLoss },
      tiebreakers: parseTiebreakers(season.tiebreakers),
    },
  );
}

async function main() {
  const season = await db.season.findFirstOrThrow({ where: { isActive: true } });
  const pending = await db.match.findFirstOrThrow({
    where: { seasonId: season.id, status: "PENDING" },
    include: { homeTeam: true, awayTeam: true },
  });
  const original = { status: pending.status, homeGoals: pending.homeGoals, awayGoals: pending.awayGoals };

  const before = await standingsNow(season.id);
  const homeBefore = before.find((r) => r.team.id === pending.homeTeamId)!;
  const awayBefore = before.find((r) => r.team.id === pending.awayTeamId)!;

  console.log(`\nนัดทดสอบ: ${pending.homeTeam.shortName} ${pending.homeGoals}–${pending.awayGoals} ${pending.awayTeam.shortName} (สถานะ ${pending.status})\n`);

  check(
    "ผลรออนุมัติยังไม่ถูกนับ",
    homeBefore.played === 5 && awayBefore.played === 5,
    `${pending.homeTeam.shortName} แข่ง ${homeBefore.played} นัด`,
  );

  // จำลองการอนุมัติ (เหมือนที่ approveMatchAction ทำ)
  await db.match.update({ where: { id: pending.id }, data: { status: "FINISHED" } });
  const after = await standingsNow(season.id);
  const homeAfter = after.find((r) => r.team.id === pending.homeTeamId)!;
  const awayAfter = after.find((r) => r.team.id === pending.awayTeamId)!;

  check("หลังอนุมัติ จำนวนนัดเพิ่มขึ้น 1", homeAfter.played === homeBefore.played + 1 && awayAfter.played === awayBefore.played + 1);

  const hg = pending.homeGoals!, ag = pending.awayGoals!;
  const expectHome = homeBefore.points + (hg > ag ? season.pointsWin : hg === ag ? season.pointsDraw : season.pointsLoss);
  const expectAway = awayBefore.points + (ag > hg ? season.pointsWin : hg === ag ? season.pointsDraw : season.pointsLoss);

  check("แต้มทีมเหย้าถูกต้อง", homeAfter.points === expectHome, `ได้ ${homeAfter.points} คาด ${expectHome}`);
  check("แต้มทีมเยือนถูกต้อง", awayAfter.points === expectAway, `ได้ ${awayAfter.points} คาด ${expectAway}`);
  check("ประตูได้/เสียถูกบวกเข้าทั้งสองฝั่ง",
    homeAfter.goalsFor === homeBefore.goalsFor + hg &&
    homeAfter.goalsAgainst === homeBefore.goalsAgainst + ag &&
    awayAfter.goalsFor === awayBefore.goalsFor + ag &&
    awayAfter.goalsAgainst === awayBefore.goalsAgainst + hg);
  check("ฟอร์มล่าสุดอัปเดต", homeAfter.form.length > 0 && homeAfter.form.at(-1)!.matchId === pending.id);
  check("ผลรวมผลต่างประตูทั้งลีกยังเป็น 0", after.reduce((s, r) => s + r.goalDiff, 0) === 0);

  // คืนสถานะเดิม
  await db.match.update({ where: { id: pending.id }, data: original });
  const restored = await standingsNow(season.id);
  check("คืนค่าเดิมเรียบร้อย", JSON.stringify(restored) === JSON.stringify(before));

  // กฎการแบ่งอันดับ: ทีมที่แต้มเท่ากันต้องเรียงตาม tiebreaker ที่ตั้งไว้
  const tied = new Map<number, typeof before>();
  for (const r of before) tied.set(r.points, [...(tied.get(r.points) ?? []), r]);
  let tieOk = true;
  for (const group of tied.values()) {
    for (let i = 1; i < group.length; i++) {
      if (group[i - 1].goalDiff < group[i].goalDiff) tieOk = false;
    }
  }
  check("ทีมแต้มเท่ากันเรียงตามผลต่างประตูถูกต้อง", tieOk);

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main();
