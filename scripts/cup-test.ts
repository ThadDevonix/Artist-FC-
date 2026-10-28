/**
 * ทดสอบฤดูกาลแบบแบ่งกลุ่ม + น็อคเอาต์ แบบ end-to-end ผ่าน HTTP จริง
 *   สร้างฤดูกาล 2 กลุ่ม × 3 ทีม ผ่านกลุ่มละ 2 · รองฯ เหย้า-เยือน + นัดชิงนัดเดียว · เปิดต่อเวลา 15 นาที + จุดโทษ
 *   ใส่สโมสรลงช่อง → บันทึกผลในกลุ่ม → กลุ่มจบแล้วทีมเข้าสายเอง (ไขว้ 1A–2B, 1B–2A)
 *   รองฯ คู่ 1: ประตูรวมเสมอ → ต้องกรอกจุดโทษ → ผู้ชนะจุดโทษเข้านัดชิง
 *   รองฯ คู่ 2 นัดสอง (ถ่ายทอดสด): เสมอหลังเวลาปกติ → ปุ่มต่อเวลา 2 ช่วง → จบเกมต้องกรอกจุดโทษ
 *   ตีกลับผลนัดชิงไม่ได้ทำ แต่ตีกลับผลรองฯ → ทีมในนัดชิงกลับเป็นชื่อชั่วคราว
 * ใช้ฤดูกาล/ทีมชั่วคราว (ไม่ใช่ฤดูกาลที่ใช้งานอยู่) แล้วลบทิ้งใน finally เสมอ
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

/** ค่า hidden ของ server action ในฟอร์มที่มีข้อความ marker (ฟอร์มทำงานได้แม้ไม่มี JS) */
function actionFields(html: string, marker: string) {
  const form = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes(marker));
  if (!form) throw new Error(`ไม่พบฟอร์มที่มี ${marker}`);
  const body = new FormData();
  for (const tag of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (!name) continue;
    body.append(name, (/value="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  return body;
}

async function login(email: string, password: string) {
  const body = actionFields(await (await fetch(`${BASE}/admin/login`)).text(), 'name="password"');
  body.append("email", email);
  body.append("password", password);
  const res = await fetch(`${BASE}/admin/login`, { method: "POST", body, redirect: "manual" });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie.includes("artistfc_session=")) throw new Error(`ล็อกอิน ${email} ไม่สำเร็จ`);
  return cookie;
}

let cookie = "";
const page = async (path: string) => (await (await fetch(`${BASE}${path}`, { headers: { cookie } })).text()).replace(/<!-- -->/g, "");

async function submit(path: string, marker: string, fields: Record<string, string> = {}) {
  const body = actionFields(await (await fetch(`${BASE}${path}`, { headers: { cookie } })).text(), marker);
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const res = await fetch(`${BASE}${path}`, { method: "POST", body, headers: { cookie }, redirect: "manual" });
  return res.text();
}

const stamp = Date.now();
const seasonName = `ทดสอบถ้วย ${stamp}`;

async function main() {
  const clubs = await Promise.all(
    ["A1", "A2", "A3", "B1", "B2", "B3"].map((c, i) =>
      db.team.create({ data: { name: `สโมสรถ้วย ${c}`, shortName: `ถ้วย${c}`, code: `C${i}`, slug: `cup-test-${i}-${stamp}` } }),
    ),
  );
  const club = (code: string) => clubs[["A1", "A2", "A3", "B1", "B2", "B3"].indexOf(code)];

  try {
    cookie = await login("admin@artistfc.local", "admin1234");

    console.log("\n— สร้างฤดูกาลแบบแบ่งกลุ่ม —");
    await submit("/admin/seasons", 'placeholder="เช่น 2027–28"', {
      name: seasonName,
      format: "CUP",
      groupCount: "2",
      groupSize: "3",
      rounds: "1",
      advancePerGroup: "2",
      knockoutLegs: "2",
      koSettings: "1",
      extraTime: "on",
      extraTimeMinutes: "15",
      penalties: "on",
      periods: "2",
      periodMinutes: "45",
    });
    const season = await db.season.findFirstOrThrow({ where: { name: seasonName } });
    check("ฤดูกาลเป็นแบบแบ่งกลุ่ม ตั้งค่าครบ", season.format === "CUP" && season.groupCount === 2 && season.knockoutLegs === 2 && season.extraTime && season.penalties);
    const slots = await db.seasonTeam.findMany({ where: { seasonId: season.id }, orderBy: { slot: "asc" }, include: { team: true } });
    check("ช่องทีม A1–B3 แบ่งกลุ่มถูก", slots.map((s) => `${s.team.name}/${s.group}`).join(",") === "ทีม A1/1,ทีม A2/1,ทีม A3/1,ทีม B1/2,ทีม B2/2,ทีม B3/2");
    const groupMatches = await db.match.count({ where: { seasonId: season.id, group: { not: null } } });
    const ko = await db.match.findMany({ where: { seasonId: season.id, koSize: { not: null } }, include: { homeTeam: true, awayTeam: true }, orderBy: [{ round: "asc" }, { koSlot: "asc" }] });
    check("นัดในกลุ่ม 6 คู่ + น็อคเอาต์ 5 คู่ (รองฯ 2×2 + ชิง)", groupMatches === 6 && ko.length === 5, `${groupMatches} + ${ko.length}`);
    check("สายรองฯ ไขว้ 1A–2B / 1B–2A", ko[0].homeTeam.name === "ที่ 1 กลุ่ม A" && ko[0].awayTeam.name === "ที่ 2 กลุ่ม B" && ko[1].homeTeam.name === "ที่ 1 กลุ่ม B");
    const slug = encodeURIComponent(season.slug);

    console.log("\n— ใส่สโมสรลงช่อง —");
    for (const s of slots) {
      await submit(`/admin/seasons?season=${slug}`, `value="${s.id}"`, { teamId: club(s.team.name.replace("ทีม ", "")).id });
    }
    const filled = await db.seasonTeam.count({ where: { seasonId: season.id, team: { isPlaceholder: false } } });
    check("ใส่ครบ 6 ช่อง", filled === 6);

    const result = (matchId: string, fields: Record<string, string>) => submit(`/admin/matches/${matchId}`, 'name="homeGoals"', fields);
    const playGroup = async (group: number, winner: string, second: string) => {
      const ms = await db.match.findMany({ where: { seasonId: season.id, group } });
      for (const m of ms) {
        // อันดับตามลำดับ: winner ชนะทุกนัด second ชนะทีมที่ 3
        const rank = (id: string) => (id === club(winner).id ? 0 : id === club(second).id ? 1 : 2);
        const homeWins = rank(m.homeTeamId) < rank(m.awayTeamId);
        await result(m.id, { homeGoals: homeWins ? "2" : "0", awayGoals: homeWins ? "0" : "1" });
      }
    };

    console.log("\n— รอบแบ่งกลุ่ม —");
    await playGroup(1, "A1", "A2");
    const sf = await db.match.findFirstOrThrow({ where: { seasonId: season.id, koSize: 4, koSlot: 1, leg: 1 }, include: { homeTeam: true, awayTeam: true } });
    check("กลุ่ม A จบ → 1A เข้าสาย ฝั่ง 2B ยังรอ", sf.homeTeamId === club("A1").id && sf.awayTeam.name === "ที่ 2 กลุ่ม B");
    const standings = await page(`/standings?season=${slug}`);
    check("หน้าตารางคะแนนแสดงแยกกลุ่ม + สายน็อคเอาต์", standings.includes("กลุ่ม A") && standings.includes("กลุ่ม B") && standings.includes("รอบรองชนะเลิศ") && standings.includes("แข่งครบแล้ว"));
    await playGroup(2, "B1", "B2");
    const semis = await db.match.findMany({ where: { seasonId: season.id, koSize: 4 }, orderBy: [{ koSlot: "asc" }, { leg: "asc" }] });
    check(
      "กลุ่ม B จบ → รองฯ ครบ: A1–B2 (นัดสองสลับเหย้า), B1–A2",
      semis[0].homeTeamId === club("A1").id && semis[0].awayTeamId === club("B2").id &&
        semis[1].homeTeamId === club("B2").id && semis[1].awayTeamId === club("A1").id &&
        semis[2].homeTeamId === club("B1").id && semis[2].awayTeamId === club("A2").id,
    );

    console.log("\n— รองฯ คู่ 1: ประตูรวมเสมอ → จุดโทษ —");
    await result(semis[0].id, { homeGoals: "1", awayGoals: "0" });
    let msg = await result(semis[1].id, { homeGoals: "1", awayGoals: "0" });
    check("รวมเสมอ ไม่กรอกจุดโทษ → ถูกปฏิเสธ", msg.includes("กรอกผลยิงจุดโทษ") && (await db.match.findUniqueOrThrow({ where: { id: semis[1].id } })).status === "SCHEDULED");
    msg = await result(semis[1].id, { homeGoals: "1", awayGoals: "0", homePens: "3", awayPens: "3" });
    check("จุดโทษเท่ากัน → ถูกปฏิเสธ", msg.includes("ต้องมีผู้ชนะ"));
    await result(semis[1].id, { homeGoals: "1", awayGoals: "0", homePens: "4", awayPens: "3" });
    let final = await db.match.findFirstOrThrow({ where: { seasonId: season.id, koSize: 2 }, include: { awayTeam: true } });
    check("B2 ชนะจุดโทษ → เข้านัดชิง", final.homeTeamId === club("B2").id && final.awayTeam.name === "ผู้ชนะรองฯ คู่ 2");
    const matchPage = await page(`/matches/${semis[1].id}`);
    check("หน้านัดแสดงจุดโทษและประตูรวม", matchPage.includes("จุดโทษ 4–3") && matchPage.includes("รวมสองนัด 1–1"));

    console.log("\n— รองฯ คู่ 2 นัดสอง: ถ่ายทอดสด ต่อเวลา + จุดโทษ —");
    await result(semis[2].id, { homeGoals: "0", awayGoals: "0" });
    const live = `/admin/matches/${semis[3].id}`;
    await submit(live, "เริ่มถ่ายทอดสด");
    const state = () => db.match.findUniqueOrThrow({ where: { id: semis[3].id }, select: { livePeriod: true, liveBreak: true, status: true } });
    await submit(live, "พักครึ่ง");
    await submit(live, "เริ่มครึ่งหลัง");
    let html = await page(live);
    check("จบเวลาปกติเสมอ → มีปุ่มพักก่อนต่อเวลา", html.includes("พักก่อนต่อเวลา"));
    await submit(live, "พักก่อนต่อเวลา");
    await submit(live, "เริ่มต่อเวลาครึ่งแรก");
    let st = await state();
    check("ต่อเวลาครึ่งแรก = ช่วงที่ 3", st.livePeriod === 3 && !st.liveBreak);
    const pub = await page(`/matches/${semis[3].id}`);
    check("หน้าเว็บนับนาทีต่อจาก 90 → 91'", pub.includes("91&#x27;") || pub.includes("91'"));
    await submit(live, "พักครึ่งต่อเวลา");
    await submit(live, "เริ่มต่อเวลาครึ่งหลัง");
    st = await state();
    html = await page(live);
    check("ต่อเวลาครึ่งหลังแล้วไม่มีปุ่มพักอีก", st.livePeriod === 4 && !html.includes("⏸") && html.includes('name="homePens"'));
    msg = await submit(live, "จบเกม");
    check("จบเกมโดยไม่กรอกจุดโทษ → ถูกปฏิเสธ", msg.includes("กรอกผลยิงจุดโทษ") && (await state()).status === "LIVE");
    await submit(live, "จบเกม", { homePens: "5", awayPens: "4" });
    final = await db.match.findFirstOrThrow({ where: { seasonId: season.id, koSize: 2 }, include: { awayTeam: true } });
    check("A2 (เจ้าบ้านนัดสอง) ชนะจุดโทษ → นัดชิงครบสองทีม", (await state()).status === "FINISHED" && final.awayTeamId === club("A2").id);

    console.log("\n— ตีกลับผล → นัดชิงคืนเป็นชื่อชั่วคราว —");
    await submit(`/admin/matches/${semis[3].id}`, 'name="homeGoals"', { homeGoals: "0", awayGoals: "0", homePens: "5", awayPens: "4" });
    await db.match.update({ where: { id: semis[3].id }, data: { status: "PENDING" } });
    await submit(`/admin/matches/${semis[3].id}`, "ตีกลับ");
    final = await db.match.findFirstOrThrow({ where: { seasonId: season.id, koSize: 2 }, include: { awayTeam: true } });
    check("ตีกลับรองฯ นัดสอง → ฝั่งเยือนนัดชิงกลับเป็น 'ผู้ชนะรองฯ คู่ 2'", final.awayTeam.name === "ผู้ชนะรองฯ คู่ 2");

    const fixtures = await page(`/fixtures?season=${slug}`);
    check("หน้าการแข่งขันมีหัวข้อรอบน็อคเอาต์", fixtures.includes("รอบรองชนะเลิศ นัดแรก") && fixtures.includes("นัดชิงชนะเลิศ"));
  } finally {
    const season = await db.season.findFirst({ where: { name: seasonName } });
    if (season) {
      await db.auditLog.deleteMany({ where: { entityId: season.id } });
      const placeholders = await db.seasonTeam.findMany({ where: { seasonId: season.id, team: { isPlaceholder: true } }, select: { teamId: true } });
      await db.season.delete({ where: { id: season.id } });
      await db.team.deleteMany({ where: { id: { in: placeholders.map((p) => p.teamId) } } });
      await db.team.deleteMany({ where: { slug: { startsWith: `ko-${season.id}-` } } });
    }
    await db.team.deleteMany({ where: { id: { in: clubs.map((c) => c.id) } } });
    await db.$disconnect();
  }

  console.log(failures ? `\nไม่ผ่าน ${failures} รายการ ✗` : "\nผ่านทั้งหมด ✓");
  if (failures) process.exitCode = 1;
}

main();
