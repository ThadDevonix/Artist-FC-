/**
 * ทดสอบโหมดถ่ายทอดสดแบบ end-to-end ผ่าน HTTP จริง
 *   เริ่มถ่ายทอด → 0–0 · บันทึกประตู/ทำเข้าประตูตัวเอง → สกอร์ขยับเอง · ลบเหตุการณ์ → สกอร์ลด
 *   ตารางคะแนนนับนัดที่กำลังแข่งทันที (อันดับขยับตามประตู) · กดจบเกม → ผลจากเหตุการณ์ อนุมัติทันที
 *   นาฬิกา: เริ่มครึ่งแรก 1' → พักครึ่ง → ครึ่งหลังนับต่อจาก 45' → จบเกมแล้วหยุด
 *   ฤดูกาลแบบ 4 ควอเตอร์: ปุ่มพัก/เริ่มไล่ทีละควอเตอร์ · ควอเตอร์สุดท้ายเหลือแค่ปุ่มจบเกม
 * ใช้ฤดูกาล/ทีม/นัดชั่วคราวที่ไม่ใช่ฤดูกาลปัจจุบัน (ไม่โผล่บนหน้าแรก) แล้วลบทิ้งใน finally เสมอ
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

async function submit(url: string, cookie: string, marker: string, fields: Record<string, string> = {}) {
  const body = actionFields(await (await fetch(url, { headers: { cookie } })).text(), marker);
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const res = await fetch(url, { method: "POST", body, headers: { cookie }, redirect: "manual" });
  return res.text();
}

async function main() {
  const stamp = Date.now();
  const season = await db.season.create({ data: { name: "ทดสอบถ่ายทอดสด", slug: `live-test-${stamp}` } });
  const [home, away] = await Promise.all(
    ["ทีมทดสอบเหย้า", "ทีมทดสอบเยือน"].map((name, i) =>
      db.team.create({ data: { name, shortName: name, code: `LT${i}`, slug: `live-test-${i}-${stamp}` } }),
    ),
  );
  await db.seasonTeam.createMany({ data: [home, away].map((t) => ({ seasonId: season.id, teamId: t.id })) });
  const [homeFw, awayDf] = await Promise.all([
    db.player.create({ data: { name: "กองหน้าทดสอบ", slug: `live-fw-${stamp}`, teamId: home.id, position: "FW" } }),
    db.player.create({ data: { name: "กองหลังทดสอบ", slug: `live-df-${stamp}`, teamId: away.id, position: "DF" } }),
  ]);
  const match = await db.match.create({
    // แจ้งเวลาเตะไว้ 30 นาทีก่อน (จำลองนัดเลท) — ตอนกดเริ่ม เวลาเตะต้องเปลี่ยนเป็นเวลาที่กดจริง
    data: { seasonId: season.id, round: 1, homeTeamId: home.id, awayTeamId: away.id, kickoffAt: new Date(stamp - 30 * 60_000) },
  });
  const url = `${BASE}/admin/matches/${match.id}`;
  const score = async () => {
    const m = await db.match.findUniqueOrThrow({ where: { id: match.id } });
    return { status: m.status, text: `${m.homeGoals ?? "-"}–${m.awayGoals ?? "-"}` };
  };
  let cookie = "";
  const goal = (fields: Record<string, string>) => submit(url, cookie, 'name="minute"', fields);

  try {
    cookie = await login("admin@artistfc.local", "admin1234");

    console.log("\n— เริ่มถ่ายทอดสด —");
    await submit(url, cookie, "เริ่มถ่ายทอดสด");
    let s = await score();
    check("สถานะเป็น LIVE สกอร์ 0–0", s.status === "LIVE" && s.text === "0–0", `${s.status} ${s.text}`);
    let phase = await db.match.findUniqueOrThrow({ where: { id: match.id }, select: { livePeriod: true, liveBreak: true, phaseStartedAt: true } });
    check("นาฬิกาเริ่มครึ่งแรก", phase.livePeriod === 1 && !phase.liveBreak && phase.phaseStartedAt !== null);
    const started = await db.match.findUniqueOrThrow({ where: { id: match.id }, select: { kickoffAt: true } });
    check("เวลาเตะเปลี่ยนเป็นเวลาที่กดจริง (นัดเลท)", Math.abs(started.kickoffAt!.getTime() - Date.now()) < 60_000);
    const startLog = await db.auditLog.findFirst({ where: { entityId: match.id, action: "MATCH_LIVE_START" } });
    check("ประวัติเก็บเวลาที่แจ้งไว้เดิม", (startLog?.detail ?? "").includes(new Date(stamp - 30 * 60_000).toISOString()));
    const clockHtml = await (await fetch(`${BASE}/matches/${match.id}`)).text();
    check("หน้านัดแสดงนาที 1'", clockHtml.includes("1&#x27;") || clockHtml.includes("1'"));

    console.log("\n— สกอร์นับจากเหตุการณ์ —");
    await goal({ teamId: home.id, type: "GOAL", playerId: homeFw.id, minute: "12" });
    s = await score();
    check("ประตูเจ้าบ้าน → 1–0", s.text === "1–0", s.text);
    // ทำเข้าประตูตัวเอง: เลือก "ทีมที่ได้ประโยชน์" = ทีมเยือน นักเตะเป็นฝั่งเจ้าบ้าน
    await goal({ teamId: away.id, type: "OWN_GOAL", playerId: homeFw.id, minute: "30" });
    s = await score();
    check("ทำเข้าประตูตัวเองนับให้ทีมที่ได้ประโยชน์ → 1–1", s.text === "1–1", s.text);
    await goal({ teamId: away.id, type: "YELLOW", playerId: awayDf.id, minute: "35" });
    s = await score();
    check("ใบเหลืองไม่กระทบสกอร์", s.text === "1–1", s.text);

    const matchHtml = await (await fetch(`${BASE}/matches/${match.id}`)).text();
    check("หน้านัดแสดง LIVE และสกอร์สด", matchHtml.includes("LIVE") && matchHtml.includes("1<!-- -->–<!-- -->1"));

    const standingsHtml = await (await fetch(`${BASE}/standings?season=${season.slug}`)).text();
    check("ตารางคะแนนแสดงสกอร์ของทีมที่กำลังแข่ง", standingsHtml.includes("สกอร์ปัจจุบัน (กำลังแข่ง)"));
    check("ไม่มีแท็บตารางสด/ทางการแยก", !standingsHtml.includes("ตารางสด"));
    check(
      "ตารางคะแนนแสดงนาทีหลังสกอร์",
      /สกอร์ปัจจุบัน \(กำลังแข่ง\)[\s\S]{0,300}?\d+(\+\d+)?(&#x27;|')/.test(standingsHtml),
    );
    // 1–1 ระหว่างแข่ง → ตารางนับเป็นเสมอ ทีมละ 1 แต้ม
    const homePoints = new RegExp(`${home.shortName}[\\s\\S]*?font-bold sm:pr-0">(\\d+)<`).exec(standingsHtml)?.[1];
    check("ตารางนับนัดที่กำลังแข่งทันที (เสมอ 1–1 = 1 แต้ม)", homePoints === "1", `แต้ม ${homePoints ?? "?"}`);

    console.log("\n— ลบเหตุการณ์ —");
    const own = await db.matchEvent.findFirstOrThrow({ where: { matchId: match.id, type: "OWN_GOAL" } });
    const html = await (await fetch(url, { headers: { cookie } })).text();
    const delForm = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes(own.id));
    if (!delForm) throw new Error("ไม่พบปุ่มลบเหตุการณ์");
    await submit(url, cookie, own.id);
    s = await score();
    check("ลบประตูแล้วสกอร์ลด → 1–0", s.text === "1–0", s.text);

    console.log("\n— พักครึ่ง / ครึ่งหลัง —");
    await submit(url, cookie, "พักครึ่ง");
    phase = await db.match.findUniqueOrThrow({ where: { id: match.id }, select: { livePeriod: true, liveBreak: true, phaseStartedAt: true } });
    check("พักครึ่ง", phase.livePeriod === 1 && phase.liveBreak);
    const htHtml = await (await fetch(`${BASE}/matches/${match.id}`)).text();
    check("หน้านัดแสดง 'พักครึ่ง'", htHtml.includes("พักครึ่ง"));
    await submit(url, cookie, "เริ่มครึ่งหลัง");
    phase = await db.match.findUniqueOrThrow({ where: { id: match.id }, select: { livePeriod: true, liveBreak: true, phaseStartedAt: true } });
    check("เริ่มครึ่งหลัง", phase.livePeriod === 2 && !phase.liveBreak);
    const shHtml = await (await fetch(`${BASE}/matches/${match.id}`)).text();
    check("ครึ่งหลังนับต่อจาก 45 → 46'", shHtml.includes("46&#x27;") || shHtml.includes("46'"));

    console.log("\n— จบเกม —");
    const finishedBefore = await db.match.count({ where: { seasonId: season.id, status: "FINISHED" } });
    await submit(url, cookie, "จบเกม");
    const m = await db.match.findUniqueOrThrow({ where: { id: match.id } });
    check("จบเกมด้วยสกอร์จากเหตุการณ์ 1–0", m.status === "FINISHED" && m.homeGoals === 1 && m.awayGoals === 0, `${m.status} ${m.homeGoals}–${m.awayGoals}`);
    check("แอดมินจบเกม = อนุมัติทันที", m.approvedAt !== null);
    check("จบเกมแล้วนาฬิกาหยุด", m.livePeriod === null && !m.liveBreak && m.phaseStartedAt === null);
    const finishedAfter = await db.match.count({ where: { seasonId: season.id, status: "FINISHED" } });
    check("เข้าตารางคะแนนทางการ", finishedAfter === finishedBefore + 1);

    console.log("\n— ฤดูกาลแบบ 4 ควอเตอร์ × 12 นาที —");
    await db.season.update({ where: { id: season.id }, data: { periods: 4, periodMinutes: 12 } });
    const q = await db.match.create({ data: { seasonId: season.id, round: 2, homeTeamId: away.id, awayTeamId: home.id } });
    const qUrl = `${BASE}/admin/matches/${q.id}`;
    const qState = () => db.match.findUniqueOrThrow({ where: { id: q.id }, select: { livePeriod: true, liveBreak: true } });
    await submit(qUrl, cookie, "เริ่มถ่ายทอดสด");
    let qHtml = await (await fetch(qUrl, { headers: { cookie } })).text();
    check("ควอเตอร์แรกมีปุ่มพักหลังควอเตอร์ที่ 1", qHtml.includes("พักหลังควอเตอร์ที่ 1") && !qHtml.includes("พักครึ่ง"));
    for (let n = 1; n < 4; n++) {
      await submit(qUrl, cookie, `พักหลังควอเตอร์ที่ ${n}`);
      let st = await qState();
      check(`พักหลังควอเตอร์ที่ ${n}`, st.livePeriod === n && st.liveBreak);
      await submit(qUrl, cookie, `เริ่มควอเตอร์ที่ ${n + 1}`);
      st = await qState();
      check(`เริ่มควอเตอร์ที่ ${n + 1}`, st.livePeriod === n + 1 && !st.liveBreak);
    }
    const q4 = await (await fetch(`${BASE}/matches/${q.id}`)).text();
    check("ควอเตอร์ที่ 4 นับต่อจาก 36 → 37'", q4.includes("37&#x27;") || q4.includes("37'"));
    qHtml = await (await fetch(qUrl, { headers: { cookie } })).text();
    check("ควอเตอร์สุดท้ายไม่มีปุ่มพัก เหลือแค่จบเกม", !qHtml.includes("⏸") && qHtml.includes("จบเกม"));
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: match.id } });
    await db.season.delete({ where: { id: season.id } }); // นัด/เหตุการณ์ถูกลบตาม (cascade)
    await db.team.deleteMany({ where: { id: { in: [home.id, away.id] } } }); // นักเตะถูกลบตาม
    await db.$disconnect();
  }

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
