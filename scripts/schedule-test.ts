/**
 * ทดสอบการสร้างตารางด้วยจำนวนทีม + จัดวันเวลาแข่ง + เขตเวลา ผ่าน HTTP จริง
 *   สร้างฤดูกาล 4 ทีม → ได้ช่อง "ทีม 1–4" และตารางครบทุกคู่ ยังไม่มีวัน
 *   ใส่สโมสรลงช่อง / เพิ่ม / เอาออก → นัดย้ายตามโดยไม่ขาดคู่
 *   20 ทีม เหย้า–เยือน = 38 นัด · นัดเดียว = 19 นัด
 *   ตั้งวันอัตโนมัติทุกจันทร์/ศุกร์ 19:00 → คู่กระจายตามวัน เก็บเป็น 12:00 UTC (เวลาไทย)
 *   จัดวันเวลาหลายคู่คนละวันในหน้าเดียว
 *   แก้วันเวลาในรายละเอียดนัด → ตีความเป็นเวลาไทย
 * ควรรันกับเซิร์ฟเวอร์ที่ตั้ง TZ=UTC (แบบ Vercel) — บนเครื่องที่ตั้งเวลาไทย บั๊กเขตเวลาจะไม่โผล่
 * ใช้ฤดูกาล/ทีมชั่วคราว แล้วลบทิ้งใน finally เสมอ
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

function actionFields(html: string, marker: string) {
  const form = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes(marker));
  if (!form) throw new Error(`ไม่พบฟอร์มที่มี ${marker}`);
  const body = new FormData();
  for (const tag of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (name) body.append(name, (/value="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  return body;
}

async function main() {
  const stamp = Date.now();
  const name = `จัดวันทดสอบ ${stamp}`;
  const clubs = await Promise.all(
    [0, 1].map((i) =>
      db.team.create({ data: { name: `ทีมจัดวัน ${i}`, shortName: `จว${i}`, code: `SC${i}`, slug: `schedule-test-${i}-${stamp}`, venue: `สนามจว${i}` } }),
    ),
  );
  let seasonId = "";

  try {
    const loginBody = actionFields(await (await fetch(`${BASE}/admin/login`)).text(), 'name="password"');
    loginBody.append("email", "admin@artistfc.local");
    loginBody.append("password", "admin1234");
    const cookie = ((await fetch(`${BASE}/admin/login`, { method: "POST", body: loginBody, redirect: "manual" })).headers.get("set-cookie") ?? "").split(";")[0];
    const post = async (url: string, marker: string, fields: Record<string, string | string[]>) => {
      const body = actionFields(await (await fetch(url, { headers: { cookie } })).text(), marker);
      for (const [k, v] of Object.entries(fields)) {
        body.delete(k);
        for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
      }
      return (await fetch(url, { method: "POST", body, headers: { cookie }, redirect: "manual" })).text();
    };
    const slots = () =>
      db.seasonTeam.findMany({ where: { seasonId }, orderBy: { slot: "asc" }, include: { team: true } });
    const count = (where = {}) => db.match.count({ where: { seasonId, ...where } });

    console.log("\n— สร้างฤดูกาลพร้อมจำนวนทีม —");
    await post(`${BASE}/admin/seasons`, "ระบบจะสร้างตารางแข่งให้ครบ", { name, teamCount: "4", rounds: "1" });
    const season = await db.season.findFirstOrThrow({ where: { name } });
    seasonId = season.id;
    const page = `${BASE}/admin/seasons?season=${encodeURIComponent(season.slug)}`;
    let s = await slots();
    check("ได้ช่อง ทีม 1–4", s.map((x) => x.team.name).join(",") === "ทีม 1,ทีม 2,ทีม 3,ทีม 4" && s.every((x) => x.team.isPlaceholder));
    check("ตาราง 6 คู่ 3 นัด", (await count()) === 6 && (await count({ round: 3 })) === 2, String(await count()));
    check("ยังไม่มีวันเวลา", (await count({ kickoffAt: null })) === 6);
    check("ช่องทีมไม่โผล่ในรายชื่อสโมสร", !(await (await fetch(`${BASE}/admin/teams`, { headers: { cookie } })).text()).includes("ทีม 3<"));

    console.log("\n— ใส่สโมสรลงช่อง —");
    const slot1 = s[0];
    const assigned = await post(page, `name="seasonTeamId" value="${slot1.id}"`, { teamId: clubs[0].id });
    check("แจ้งผล", assigned.includes("ทีม 1 → ทีมจัดวัน 0"));
    check("นัดของทีม 1 เป็นของสโมสร (3 คู่)", (await count({ OR: [{ homeTeamId: clubs[0].id }, { awayTeamId: clubs[0].id }] })) === 3);
    check("ทีมชั่วคราวถูกลบ", !(await db.team.findUnique({ where: { id: slot1.teamId } })));
    check("นัดเหย้าได้สนามของสโมสร", (await count({ homeTeamId: clubs[0].id, venue: "สนามจว0" })) === (await count({ homeTeamId: clubs[0].id })));

    await post(page, `name="teamId" value="${clubs[1].id}"`, {});
    s = await slots();
    check("กดเพิ่ม → ลงช่องว่างแรก (ทีม 2)", s[1].teamId === clubs[1].id && (await count()) === 6);

    await post(page, `name="teamId" value="${clubs[0].id}"`, {});
    s = await slots();
    check("เอาออก → คืนเป็น ทีม 1 ตารางยังครบ", s[0].team.name === "ทีม 1" && s[0].team.isPlaceholder && (await count()) === 6);

    console.log("\n— สร้างตารางใหม่ตามจำนวนทีม —");
    await post(page, "สุ่มลำดับทีมก่อนจับคู่", { teamCount: "20", rounds: "2" });
    check("20 ทีม เหย้า–เยือน = 38 นัด 380 คู่", (await count()) === 380 && (await count({ round: 38 })) === 10 && (await count({ round: 39 })) === 0);
    check("สโมสรเดิมยังอยู่ในช่อง 2", (await slots())[1].teamId === clubs[1].id && (await slots()).length === 20);
    await post(page, "สุ่มลำดับทีมก่อนจับคู่", { teamCount: "20", rounds: "1" });
    check("20 ทีม นัดเดียว = 19 นัด 190 คู่", (await count()) === 190 && (await count({ round: 20 })) === 0);
    const tooFew = await post(page, "สุ่มลำดับทีมก่อนจับคู่", { teamCount: "4", rounds: "1" });
    check("ลดเหลือ 4 ทีม ได้ (ลบช่องว่างท้าย ๆ)", tooFew.includes("สร้างตารางแล้ว 3 นัด") && (await slots()).length === 4, String((await slots()).length));
    check("ช่องทีมชั่วคราวที่เกินถูกลบ", (await db.team.count({ where: { slug: { startsWith: `slot-${seasonId}-` } } })) === 3);

    console.log("\n— ตั้งวันเวลาอัตโนมัติ —");
    const schedule = `${BASE}/admin/schedule?season=${encodeURIComponent(season.slug)}`;
    // แข่งทุกจันทร์กับศุกร์ 19:00 — 4 ทีม = นัดละ 2 คู่ → คู่แรกจันทร์ คู่ที่สองศุกร์
    await post(schedule, "ตั้งวันเวลาอัตโนมัติ", { startDate: "2026-11-16", weekdays: ["1", "5"], kickoffTimes: "19:00", weeksBetween: "1" });
    const r1 = await db.match.findMany({ where: { seasonId, round: 1 }, orderBy: { kickoffAt: "asc" } });
    const r2 = await db.match.findMany({ where: { seasonId, round: 2 }, orderBy: { kickoffAt: "asc" } });
    check("19:00 เวลาไทย เก็บเป็น 12:00 UTC (จันทร์ 16)", r1[0]?.kickoffAt?.toISOString() === "2026-11-16T12:00:00.000Z", r1[0]?.kickoffAt?.toISOString());
    check("คู่ที่สองของนัด 1 ไปวันศุกร์ 20", r1[1]?.kickoffAt?.toISOString() === "2026-11-20T12:00:00.000Z", r1[1]?.kickoffAt?.toISOString());
    check("นัด 2 สัปดาห์ถัดไป (จันทร์ 23)", r2[0]?.kickoffAt?.toISOString() === "2026-11-23T12:00:00.000Z", r2[0]?.kickoffAt?.toISOString());
    const noDay = await post(schedule, "ตั้งวันเวลาอัตโนมัติ", { startDate: "2026-11-16", kickoffTimes: "19:00" });
    check("ไม่เลือกวันแข่ง → แจ้งเตือน", noDay.includes("กรุณาเลือกวันที่แข่ง"));

    console.log("\n— จัดวันเวลาหลายคู่ในหน้าเดียว —");
    const round1 = await db.match.findMany({ where: { seasonId, round: 1 }, orderBy: { id: "asc" } });
    const fields: Record<string, string> = {};
    round1.forEach((m, i) => {
      fields[`date_${m.id}`] = i === 0 ? "2026-11-16" : ""; // คู่แรกวันจันทร์ คู่ที่สองยังไม่กำหนด
      fields[`time_${m.id}`] = i === 0 ? "18:30" : "";
      fields[`venue_${m.id}`] = i === 0 ? "สนามจันทร์" : "สนามเสาร์";
    });
    const saved = await post(`${schedule}&round=1`, "บันทึกวันเวลานัดที่", fields);
    const after = await db.match.findMany({ where: { id: { in: round1.map((m) => m.id) } }, orderBy: { id: "asc" } });
    check("คู่แรก จันทร์ 18:30", after[0].kickoffAt?.toISOString() === "2026-11-16T11:30:00.000Z" && after[0].venue === "สนามจันทร์", after[0].kickoffAt?.toISOString());
    check("คู่ที่สอง เว้นว่าง = ยังไม่กำหนดวัน", after[1].kickoffAt === null && after[1].venue === "สนามเสาร์");
    check("แจ้งผลบันทึก", saved.includes("บันทึกวันเวลาแข่ง 2 คู่แล้ว"));
    const half = await post(`${schedule}&round=1`, "บันทึกวันเวลานัดที่", { ...fields, [`time_${round1[0].id}`]: "" });
    check("กรอกแค่วัน ไม่กรอกเวลา → แจ้งเตือน", half.includes("กรอกทั้งวันและเวลา"));
    const fixtures = await (await fetch(`${BASE}/fixtures?season=${encodeURIComponent(season.slug)}&round=1`)).text();
    check("หน้าโปรแกรมแข่งแสดง รอกำหนดวัน", fixtures.includes("รอกำหนดวัน"));

    console.log("\n— แก้วันเวลาในรายละเอียดนัด —");
    await post(`${BASE}/admin/matches/${round1[0].id}`, "บันทึกรายละเอียด", { kickoffAt: "2026-11-17T20:15" });
    const edited = await db.match.findUniqueOrThrow({ where: { id: round1[0].id } });
    check("20:15 เวลาไทย เก็บเป็น 13:15 UTC", edited.kickoffAt?.toISOString() === "2026-11-17T13:15:00.000Z", edited.kickoffAt?.toISOString());
  } finally {
    if (seasonId) {
      const ids = (await db.match.findMany({ where: { seasonId }, select: { id: true } })).map((m) => m.id);
      await db.auditLog.deleteMany({ where: { entityId: { in: [seasonId, ...ids] } } });
      await db.season.delete({ where: { id: seasonId } });
      await db.team.deleteMany({ where: { slug: { startsWith: `slot-${seasonId}-` } } });
    }
    await db.team.deleteMany({ where: { id: { in: clubs.map((t) => t.id) } } });
    await db.$disconnect();
  }

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
