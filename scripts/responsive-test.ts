/**
 * ตรวจว่าหน้าเว็บไม่มีอะไรบังคับความกว้างเกินจอมือถือ
 *
 * ตรวจจาก HTML ที่เซิร์ฟเวอร์ส่งมาจริง:
 *   - ไม่มี min-width / width ที่ตายตัวเกินความกว้างจอเล็กสุด
 *   - ตารางที่กว้างต้องอยู่ในกล่องที่เลื่อนแนวนอนได้
 *   - มี viewport meta ที่ถูกต้อง
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/** ความกว้างจอที่ต้องรองรับ — เล็กสุดคือ iPhone SE รุ่นแรก */
const SCREENS = [
  { name: "iPhone SE (320px)", width: 320 },
  { name: "iPhone 12/13 mini (360px)", width: 360 },
  { name: "iPhone 14/15 (390px)", width: 390 },
  { name: "iPhone Pro Max (430px)", width: 430 },
  { name: "iPad mini (768px)", width: 768 },
];
const SMALLEST = SCREENS[0].width;

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

async function html(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {} });
  return res.text();
}

/** หา min-w-[Npx] / w-[Npx] ที่กว้างเกินจอ โดยที่ไม่ได้อยู่ในกล่องเลื่อนได้ */
function findOverflow(markup: string): string[] {
  const problems: string[] = [];

  for (const m of markup.matchAll(/(?:min-)?w-\[(\d+)px\]/g)) {
    const px = Number(m[1]);
    if (px <= SMALLEST) continue;
    // ดูว่าอยู่ใน element ที่พ่อแม่เลื่อนแนวนอนได้หรือไม่
    const before = markup.slice(Math.max(0, m.index - 400), m.index);
    if (!/overflow-x-auto|overflow-auto|no-scrollbar/.test(before)) {
      problems.push(`${m[0]} (กว้าง ${px}px เกินจอ ${SMALLEST}px และไม่ได้อยู่ในกล่องเลื่อน)`);
    }
  }

  // ตารางต้องอยู่ในกล่องที่เลื่อนได้เสมอ เผื่อเนื้อหายาวผิดคาด
  for (const m of markup.matchAll(/<table[^>]*>/g)) {
    const before = markup.slice(Math.max(0, m.index - 300), m.index);
    if (!/overflow-x-auto|overflow-auto/.test(before)) {
      problems.push(`<table> ไม่ได้อยู่ในกล่องที่เลื่อนแนวนอนได้`);
    }
  }

  return [...new Set(problems)];
}

async function main() {
  const [team, player, match] = await Promise.all([
    db.team.findFirstOrThrow(),
    db.player.findFirstOrThrow(),
    db.match.findFirstOrThrow({ where: { status: "FINISHED" } }),
  ]);

  // ล็อกอินเพื่อตรวจหน้าหลังบ้านด้วย
  const loginHtml = await html("/admin/login");
  const body = new FormData();
  for (const tag of loginHtml.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (!name?.startsWith("$ACTION")) continue;
    body.append(name, (/value="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  body.append("email", "admin@artistfc.local");
  body.append("password", "admin1234");
  const res = await fetch(`${BASE}/admin/login`, { method: "POST", body, redirect: "manual" });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];

  const pages: { path: string; cookie?: string }[] = [
    { path: "/" },
    { path: "/standings" },
    { path: "/fixtures" },
    { path: "/fixtures?filter=results" },
    { path: "/stats" },
    { path: "/players" },
    { path: `/teams/${team.slug}` },
    { path: `/players/${encodeURIComponent(player.slug)}` },
    { path: `/matches/${match.id}` },
    { path: "/admin/login" },
    { path: "/admin", cookie },
    { path: "/admin/matches", cookie },
    { path: `/admin/matches/${match.id}`, cookie },
    { path: "/admin/seasons", cookie },
    { path: "/admin/teams", cookie },
    { path: "/admin/players", cookie },
    { path: "/admin/users", cookie },
    { path: "/admin/activity", cookie },
  ];

  console.log(`\nความกว้างที่รองรับ: ${SCREENS.map((s) => s.width + "px").join(", ")}`);
  console.log(`ตรวจเทียบกับจอเล็กสุด ${SMALLEST}px\n`);

  console.log("— ไม่มีอะไรล้นจอ —");
  for (const page of pages) {
    const markup = await html(page.path, page.cookie);
    const problems = findOverflow(markup);
    check(page.path, problems.length === 0, problems.join(" | "));
  }

  console.log("\n— viewport —");
  const home = await html("/");
  check("มี viewport meta", /<meta name="viewport"/.test(home));
  check("ตั้ง width=device-width", /width=device-width/.test(home));
  check("ตั้ง initial-scale=1", /initial-scale=1/.test(home));
  check("ไม่ได้ห้ามผู้ใช้ซูม", !/user-scalable=no|maximum-scale=1/.test(home));
  check("รองรับจอมีรอยบาก (viewport-fit=cover)", /viewport-fit=cover/.test(home));

  console.log("\n— ปุ่มกดบนมือถือต้องใหญ่พอ (≥36px) —");
  const adminHome = await html("/admin", cookie);
  check("ปุ่มสลับธีมขนาด 36px", /size-9/.test(adminHome));
  const matchesPage = await html("/admin/matches", cookie);
  check("หน้าบันทึกผลมีมุมมองการ์ดสำหรับมือถือ", /md:hidden/.test(matchesPage));
  check("หน้าบันทึกผลซ่อนตารางบนจอเล็ก", /hidden md:block/.test(matchesPage));

  console.log("\n— ตารางคะแนนซ่อนคอลัมน์รองบนจอเล็ก —");
  const standings = await html("/standings");
  check("มีคอลัมน์ที่ซ่อนตามขนาดจอ", /sm:table-cell/.test(standings) && /md:table-cell/.test(standings));
  check("ฟอร์ม 5 นัดโผล่เฉพาะจอใหญ่", /lg:table-cell/.test(standings));
  check("ตารางคะแนนไม่บังคับความกว้างขั้นต่ำแล้ว", !/min-w-\[6\d\dpx\]/.test(standings));

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
