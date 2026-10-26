import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateRoundRobin } from "../src/lib/fixtures";
import type { EventType, Position } from "../src/generated/prisma/enums";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ── ตัวสุ่มแบบ seed คงที่ เพื่อให้ seed ซ้ำได้ผลเหมือนเดิมทุกครั้ง ──
let rngState = 20262027;
function rnd() {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  return ((rngState >>> 0) % 100000) / 100000;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const TEAMS = [
  { name: "ลูกทุ่ง ยูไนเต็ด", shortName: "ลูกทุ่ง", code: "LTU", slug: "luktung-united", color: "#b91c1c", city: "ขอนแก่น", venue: "สนามกลางลูกทุ่ง", founded: 2014 },
  { name: "อินดี้ ซิตี", shortName: "อินดี้", code: "IDC", slug: "indie-city", color: "#0369a1", city: "กรุงเทพฯ", venue: "อินดี้ อารีนา", founded: 2016 },
  { name: "ร็อกเกอร์ส เอฟซี", shortName: "ร็อกเกอร์ส", code: "RCK", slug: "rockers-fc", color: "#1f2937", city: "ชลบุรี", venue: "ร็อก สเตเดียม", founded: 2012 },
  { name: "ป๊อปสตาร์ แอธเลติก", shortName: "ป๊อปสตาร์", code: "PSA", slug: "popstar-athletic", color: "#db2777", city: "กรุงเทพฯ", venue: "ป๊อป พาร์ค", founded: 2018 },
  { name: "แรปเปอร์ส โรเวอร์ส", shortName: "แรปเปอร์ส", code: "RPR", slug: "rappers-rovers", color: "#ea580c", city: "นนทบุรี", venue: "ไรม์ ฟิลด์", founded: 2017 },
  { name: "หมอลำ วันเดอเรอร์ส", shortName: "หมอลำ", code: "MLW", slug: "molam-wanderers", color: "#7c3aed", city: "อุดรธานี", venue: "หมอลำ สเตเดียม", founded: 2011 },
  { name: "แจ๊ส อะคาเดมี", shortName: "แจ๊ส", code: "JZA", slug: "jazz-academy", color: "#047857", city: "เชียงใหม่", venue: "บลูโน้ต กราวด์", founded: 2019 },
  { name: "ลูกกรุง เอฟซี", shortName: "ลูกกรุง", code: "LKG", slug: "lukkrung-fc", color: "#a16207", city: "พระนครศรีอยุธยา", venue: "ลูกกรุง สเตเดียม", founded: 2010 },
  { name: "ซินธ์เวฟ ยูไนเต็ด", shortName: "ซินธ์เวฟ", code: "SYN", slug: "synthwave-united", color: "#4f46e5", city: "ภูเก็ต", venue: "นีออน อารีนา", founded: 2021 },
  { name: "อคูสติก ทาวน์", shortName: "อคูสติก", code: "ACT", slug: "acoustic-town", color: "#0d9488", city: "หาดใหญ่", venue: "อคูสติก กราวด์", founded: 2015 },
];

const FIRST = ["ธนกร","ณัฐวุฒิ","ศุภชัย","พีรพล","กิตติพงษ์","อนุชา","วรเมธ","ชยพล","ภาณุพงศ์","ธีรภัทร","สหรัฐ","จิรายุ","ปกรณ์","อดิศร","นครินทร์","วิทวัส","รัชชานนท์","สิทธิชัย","ธนภัทร","เอกราช","ปรัชญา","ชนาธิป","กฤษดา","ศิวกร"];
const LAST = ["ศรีสุข","ใจดี","พงษ์ไพบูลย์","แก้วมณี","รุ่งเรือง","วงศ์คำ","บุญมา","สุขสันต์","ทองดี","อินทร์จันทร์","ชัยมงคล","เพชรรัตน์","สมบูรณ์","มั่นคง","ธารทอง","นพคุณ","สายทอง","พูลทรัพย์"];
const NATIONS = ["ไทย","ไทย","ไทย","ไทย","ไทย","บราซิล","ญี่ปุ่น","เกาหลีใต้","กานา","สเปน"];

/** โครงทีม: ผู้รักษาประตู 2, กองหลัง 5, กองกลาง 5, กองหน้า 4 */
const SQUAD: Position[] = ["GK","GK","DF","DF","DF","DF","DF","MF","MF","MF","MF","MF","FW","FW","FW","FW"];

function slugify(name: string, i: number) {
  return `${name.replace(/\s+/g, "-")}-${i}`;
}

async function main() {
  console.log("ล้างข้อมูลเดิม…");
  await db.auditLog.deleteMany();
  await db.matchEvent.deleteMany();
  await db.match.deleteMany();
  await db.seasonTeam.deleteMany();
  await db.zone.deleteMany();
  await db.player.deleteMany();
  await db.team.deleteMany();
  await db.season.deleteMany();
  await db.user.deleteMany();

  // ── ผู้ใช้งาน ──
  console.log("สร้างผู้ใช้…");
  const adminPass = await bcrypt.hash("admin1234", 10);
  const refPass = await bcrypt.hash("referee1234", 10);

  const admin = await db.user.create({
    data: { email: "admin@artistfc.local", name: "ผู้ดูแลระบบ", passwordHash: adminPass, role: "ADMIN" },
  });
  const referees = await Promise.all(
    ["สมชาย ตัดสิน", "วิไล กฎกติกา", "ประสิทธิ์ นกหวีด"].map((name, i) =>
      db.user.create({
        data: { email: `referee${i + 1}@artistfc.local`, name, passwordHash: refPass, role: "REFEREE" },
      }),
    ),
  );

  // ── ฤดูกาล ──
  console.log("สร้างฤดูกาล…");
  const season = await db.season.create({
    data: {
      name: "2026–27",
      slug: "2026-27",
      isActive: true,
      rounds: 1,
      startDate: new Date("2026-09-19T00:00:00+07:00"),
      endDate: new Date("2026-11-14T00:00:00+07:00"),
      tiebreakers: JSON.stringify(["GOAL_DIFF", "GOALS_FOR", "HEAD_TO_HEAD", "WINS", "NAME"]),
    },
  });

  await db.zone.createMany({
    data: [
      { seasonId: season.id, label: "รอบชิงชนะเลิศ", color: "#1d4ed8", fromPos: 1, toPos: 2 },
      { seasonId: season.id, label: "รอบเพลย์ออฟ", color: "#f97316", fromPos: 3, toPos: 4 },
      { seasonId: season.id, label: "ตกชั้น", color: "#dc2626", fromPos: 9, toPos: 10 },
    ],
  });

  // ── ทีม + นักเตะ ──
  console.log("สร้างทีมและนักเตะ…");
  const teams = [];
  for (const t of TEAMS) {
    const team = await db.team.create({ data: t });
    teams.push(team);
    await db.seasonTeam.create({ data: { seasonId: season.id, teamId: team.id } });

    for (let i = 0; i < SQUAD.length; i++) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      await db.player.create({
        data: {
          name,
          slug: slugify(`${t.code}-${name}`, i + 1),
          teamId: team.id,
          number: i + 1,
          position: SQUAD[i],
          nationality: pick(NATIONS),
          birthDate: new Date(int(1995, 2006), int(0, 11), int(1, 28)),
        },
      });
    }
  }

  // ── ตารางแข่งแบบพบกันหมด ──
  console.log("สร้างตารางการแข่งขัน…");
  const pairs = generateRoundRobin(teams.map((t) => t.id), { rounds: season.rounds as 1 | 2 });
  const byId = new Map(teams.map((t) => [t.id, t]));
  const seasonStart = new Date("2026-09-19T00:00:00+07:00");
  const KICKOFFS = ["15:00", "17:30", "19:30"];

  const matches = [];
  for (const p of pairs) {
    const day = new Date(seasonStart);
    day.setDate(day.getDate() + (p.round - 1) * 7);
    const [h, m] = pick(KICKOFFS).split(":").map(Number);
    const kickoffAt = new Date(
      `${day.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+07:00`,
    );

    matches.push(
      await db.match.create({
        data: {
          seasonId: season.id,
          round: p.round,
          homeTeamId: p.homeTeamId,
          awayTeamId: p.awayTeamId,
          kickoffAt,
          venue: byId.get(p.homeTeamId)?.venue ?? null,
          refereeId: pick(referees).id,
          status: "SCHEDULED",
        },
      }),
    );
  }

  // ── จำลองผลการแข่งขัน: นัด 1–5 จบแล้ว, นัด 6 รออนุมัติ, ที่เหลือยังไม่แข่ง ──
  console.log("จำลองผลการแข่งขัน…");
  const playersByTeam = new Map<string, { id: string; position: Position }[]>();
  for (const t of teams) {
    playersByTeam.set(
      t.id,
      await db.player.findMany({ where: { teamId: t.id }, select: { id: true, position: true } }),
    );
  }

  /** ถ่วงน้ำหนักให้กองหน้ายิงบ่อยกว่ากองหลัง */
  function scorer(teamId: string) {
    const squad = playersByTeam.get(teamId)!;
    const weighted = squad.flatMap((p) =>
      Array(p.position === "FW" ? 6 : p.position === "MF" ? 4 : p.position === "DF" ? 1 : 0).fill(p.id),
    );
    return pick(weighted) as string;
  }
  function anyPlayer(teamId: string) {
    return pick(playersByTeam.get(teamId)!.filter((p) => p.position !== "GK")).id;
  }

  for (const match of matches) {
    if (match.round > 6) continue;

    // ทีมเหย้าได้เปรียบเล็กน้อย
    const homeGoals = Math.max(0, int(0, 3) - (rnd() < 0.18 ? 1 : 0));
    const awayGoals = Math.max(0, int(0, 3) - (rnd() < 0.3 ? 1 : 0));
    const isPending = match.round === 6;

    const events: {
      teamId: string; playerId: string | null; assistPlayerId: string | null;
      type: EventType; minute: number;
    }[] = [];

    for (const [teamId, goals, oppId] of [
      [match.homeTeamId, homeGoals, match.awayTeamId],
      [match.awayTeamId, awayGoals, match.homeTeamId],
    ] as const) {
      for (let g = 0; g < goals; g++) {
        const ownGoal = rnd() < 0.04;
        const penalty = !ownGoal && rnd() < 0.11;
        const withAssist = !ownGoal && !penalty && rnd() < 0.62;
        const sid = ownGoal ? anyPlayer(oppId) : scorer(teamId);
        let assist: string | null = null;
        if (withAssist) {
          do { assist = anyPlayer(teamId); } while (assist === sid);
        }
        events.push({
          teamId: ownGoal ? oppId : teamId,
          playerId: sid,
          assistPlayerId: assist,
          type: ownGoal ? "OWN_GOAL" : penalty ? "PENALTY_GOAL" : "GOAL",
          minute: int(3, 92),
        });
      }
      // ใบเหลือง 0–3 ใบต่อทีม, ใบแดงนาน ๆ ครั้ง
      for (let c = 0; c < int(0, 3); c++) {
        events.push({ teamId, playerId: anyPlayer(teamId), assistPlayerId: null, type: "YELLOW", minute: int(10, 90) });
      }
      if (rnd() < 0.07) {
        events.push({ teamId, playerId: anyPlayer(teamId), assistPlayerId: null, type: "RED", minute: int(55, 90) });
      }
    }

    await db.match.update({
      where: { id: match.id },
      data: {
        homeGoals,
        awayGoals,
        status: isPending ? "PENDING" : "FINISHED",
        submittedById: match.refereeId,
        submittedAt: new Date(match.kickoffAt.getTime() + 2 * 60 * 60 * 1000),
        ...(isPending ? {} : { approvedById: admin.id, approvedAt: new Date(match.kickoffAt.getTime() + 3 * 60 * 60 * 1000) }),
        events: { create: events.sort((a, b) => a.minute - b.minute) },
      },
    });
  }

  const finished = await db.match.count({ where: { seasonId: season.id, status: "FINISHED" } });
  const pending = await db.match.count({ where: { seasonId: season.id, status: "PENDING" } });
  console.log(`
เสร็จแล้ว
  ทีม        ${teams.length}
  นักเตะ      ${teams.length * SQUAD.length}
  นัดทั้งหมด   ${matches.length}  (จบแล้ว ${finished} / รออนุมัติ ${pending})

เข้าหลังบ้านที่ /admin/login
  แอดมิน    admin@artistfc.local / admin1234
  กรรมการ   referee1@artistfc.local / referee1234
`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
