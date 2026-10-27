/**
 * ทดสอบการจัดวันเวลาแข่ง + เขตเวลา ผ่าน HTTP จริง
 *   สร้างตารางแข่งทุกจันทร์/ศุกร์ 19:00 → คู่กระจายตามวัน เก็บเป็น 12:00 UTC (เวลาไทย)
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
  const season = await db.season.create({ data: { name: `จัดวันทดสอบ ${stamp}`, slug: `schedule-test-${stamp}` } });
  const teams = await Promise.all(
    [0, 1, 2, 3].map((i) =>
      db.team.create({ data: { name: `ทีมจัดวัน ${i}`, shortName: `จว${i}`, code: `SC${i}`, slug: `schedule-test-${i}-${stamp}` } }),
    ),
  );
  await db.seasonTeam.createMany({ data: teams.map((t) => ({ seasonId: season.id, teamId: t.id })) });

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

    console.log("\n— สร้างตารางแข่ง —");
    // แข่งทุกจันทร์กับศุกร์ 19:00 — 4 ทีม = นัดละ 2 คู่ → คู่แรกจันทร์ คู่ที่สองศุกร์
    await post(`${BASE}/admin/seasons?season=${season.slug}`, "สร้างตารางแข่ง", {
      startDate: "2026-11-16", weekdays: ["1", "5"], kickoffTimes: "19:00", weeksBetween: "1", rounds: "1",
    });
    const r1 = await db.match.findMany({ where: { seasonId: season.id, round: 1 }, orderBy: { kickoffAt: "asc" } });
    const r2 = await db.match.findMany({ where: { seasonId: season.id, round: 2 }, orderBy: { kickoffAt: "asc" } });
    check("19:00 เวลาไทย เก็บเป็น 12:00 UTC (จันทร์ 16)", r1[0]?.kickoffAt.toISOString() === "2026-11-16T12:00:00.000Z", r1[0]?.kickoffAt.toISOString());
    check("คู่ที่สองของนัด 1 ไปวันศุกร์ 20", r1[1]?.kickoffAt.toISOString() === "2026-11-20T12:00:00.000Z", r1[1]?.kickoffAt.toISOString());
    check("นัด 2 สัปดาห์ถัดไป (จันทร์ 23)", r2[0]?.kickoffAt.toISOString() === "2026-11-23T12:00:00.000Z", r2[0]?.kickoffAt.toISOString());
    const noDay = await post(`${BASE}/admin/seasons?season=${season.slug}`, "สร้างตารางแข่ง", {
      startDate: "2026-11-16", kickoffTimes: "19:00", rounds: "1",
    });
    check("ไม่เลือกวันแข่ง → แจ้งเตือน", noDay.includes("กรุณาเลือกวันที่แข่ง"));

    console.log("\n— จัดวันเวลาหลายคู่ในหน้าเดียว —");
    const round1 = await db.match.findMany({ where: { seasonId: season.id, round: 1 }, orderBy: { id: "asc" } });
    const fields: Record<string, string> = {};
    round1.forEach((m, i) => {
      fields[`date_${m.id}`] = i === 0 ? "2026-11-16" : "2026-11-21"; // คู่แรกวันจันทร์ คู่ที่สองวันเสาร์
      fields[`time_${m.id}`] = i === 0 ? "18:30" : "15:00";
      fields[`venue_${m.id}`] = i === 0 ? "สนามจันทร์" : "สนามเสาร์";
    });
    const saved = await post(`${BASE}/admin/schedule?season=${season.slug}&round=1`, "บันทึกวันเวลานัดที่", fields);
    const after = await db.match.findMany({ where: { id: { in: round1.map((m) => m.id) } }, orderBy: { id: "asc" } });
    check("คู่แรก จันทร์ 18:30", after[0].kickoffAt.toISOString() === "2026-11-16T11:30:00.000Z" && after[0].venue === "สนามจันทร์", after[0].kickoffAt.toISOString());
    check("คู่ที่สอง เสาร์ 15:00", after[1].kickoffAt.toISOString() === "2026-11-21T08:00:00.000Z" && after[1].venue === "สนามเสาร์", after[1].kickoffAt.toISOString());
    check("แจ้งผลบันทึก", saved.includes("บันทึกวันเวลาแข่ง 2 คู่แล้ว"));

    console.log("\n— แก้วันเวลาในรายละเอียดนัด —");
    await post(`${BASE}/admin/matches/${round1[0].id}`, "บันทึกรายละเอียด", { kickoffAt: "2026-11-17T20:15" });
    const edited = await db.match.findUniqueOrThrow({ where: { id: round1[0].id } });
    check("20:15 เวลาไทย เก็บเป็น 13:15 UTC", edited.kickoffAt.toISOString() === "2026-11-17T13:15:00.000Z", edited.kickoffAt.toISOString());
  } finally {
    const ids = (await db.match.findMany({ where: { seasonId: season.id }, select: { id: true } })).map((m) => m.id);
    await db.auditLog.deleteMany({ where: { entityId: { in: [season.id, ...ids] } } });
    await db.season.delete({ where: { id: season.id } });
    await db.team.deleteMany({ where: { id: { in: teams.map((t) => t.id) } } });
    await db.$disconnect();
  }

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
