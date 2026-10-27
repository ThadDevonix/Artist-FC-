/**
 * ทดสอบการลบฤดูกาลผ่าน HTTP จริง
 *   มีผลแข่งแล้ว → ไม่พิมพ์ชื่อ/พิมพ์ผิด ถูกปฏิเสธ · พิมพ์ถูก → ลบได้ นัดหายตาม แต่ทีมยังอยู่
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

async function login() {
  const body = actionFields(await (await fetch(`${BASE}/admin/login`)).text(), 'name="password"');
  body.append("email", "admin@artistfc.local");
  body.append("password", "admin1234");
  const res = await fetch(`${BASE}/admin/login`, { method: "POST", body, redirect: "manual" });
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function main() {
  const stamp = Date.now();
  const season = await db.season.create({ data: { name: `ลบทดสอบ ${stamp}`, slug: `delete-test-${stamp}` } });
  const teams = await Promise.all(
    [0, 1].map((i) => db.team.create({ data: { name: `ทีมลบทดสอบ ${i}`, shortName: `ลบ${i}`, code: `DT${i}`, slug: `delete-test-${i}-${stamp}` } })),
  );
  await db.match.create({
    data: {
      seasonId: season.id, round: 1, homeTeamId: teams[0].id, awayTeamId: teams[1].id,
      kickoffAt: new Date(), status: "FINISHED", homeGoals: 1, awayGoals: 0,
    },
  });
  const url = `${BASE}/admin/seasons?season=${season.slug}`;

  try {
    const cookie = await login();
    const submit = async (fields: Record<string, string>) => {
      const body = actionFields(await (await fetch(url, { headers: { cookie } })).text(), "ลบฤดูกาลถาวร");
      for (const [k, v] of Object.entries(fields)) body.set(k, v);
      return (await fetch(url, { method: "POST", body, headers: { cookie }, redirect: "manual" })).text();
    };

    const wrong = await submit({ confirmName: "ชื่อผิด" });
    check("พิมพ์ชื่อผิด → ไม่ลบ", !!(await db.season.findUnique({ where: { id: season.id } })) && wrong.includes("พิมพ์ชื่อ"));

    await submit({ confirmName: season.name });
    check("พิมพ์ชื่อถูก → ลบฤดูกาล", !(await db.season.findUnique({ where: { id: season.id } })));
    check("นัดของฤดูกาลถูกลบตาม", (await db.match.count({ where: { seasonId: season.id } })) === 0);
    check("ทีมยังอยู่", (await db.team.count({ where: { id: { in: teams.map((t) => t.id) } } })) === 2);
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: season.id } });
    await db.season.deleteMany({ where: { id: season.id } });
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
