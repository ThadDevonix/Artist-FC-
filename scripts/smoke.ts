/**
 * ทดสอบว่าทุกหน้าขึ้นถูกต้องตามสิทธิ์ โดยสร้าง session cookie เองจาก AUTH_SECRET
 * ใช้ตอน dev เท่านั้น: npx tsx scripts/smoke.ts
 */
import "dotenv/config";
import { SignJWT } from "jose";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });

async function cookieFor(email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const token = await new SignJWT({
    userId: user.id, email: user.email, name: user.name, role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
  return `artistfc_session=${token}`;
}

async function hit(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

async function main() {
  const [season, team, player, match, pendingMatch] = await Promise.all([
    db.season.findFirstOrThrow({ where: { isActive: true } }),
    db.team.findFirstOrThrow(),
    db.player.findFirstOrThrow(),
    db.match.findFirstOrThrow({ where: { status: "FINISHED" } }),
    db.match.findFirstOrThrow({ where: { status: "PENDING" } }),
  ]);

  const adminCookie = await cookieFor("admin@artistfc.local");
  const refCookie = await cookieFor("referee1@artistfc.local");

  const publicPaths = [
    "/", "/standings", `/standings?season=${season.slug}`,
    "/fixtures", "/fixtures?filter=results", "/fixtures?filter=upcoming", "/fixtures?round=2",
    "/stats", "/players", "/players?pos=FW", `/players?team=${team.slug}`,
    `/teams/${team.slug}`, `/players/${encodeURIComponent(player.slug)}`,
    `/matches/${match.id}`, `/matches/${pendingMatch.id}`,
  ];

  const adminPaths = [
    "/admin", "/admin/matches", "/admin/matches?status=PENDING",
    `/admin/matches/${match.id}`, `/admin/matches/${pendingMatch.id}`,
    "/admin/seasons", "/admin/teams", `/admin/teams?edit=${team.id}`,
    "/admin/players", `/admin/players?edit=${player.id}`,
    "/admin/users", "/admin/activity",
  ];

  let failures = 0;
  const check = (label: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
    if (!ok) failures++;
  };

  console.log("\n— หน้าบ้าน (ไม่ต้องล็อกอิน) —");
  for (const p of publicPaths) {
    const r = await hit(p);
    check(p, r.status === 200, `HTTP ${r.status}`);
  }

  console.log("\n— หลังบ้าน: แอดมิน —");
  for (const p of adminPaths) {
    const r = await hit(p, adminCookie);
    check(p, r.status === 200, `HTTP ${r.status}`);
  }

  console.log("\n— หลังบ้าน: กรรมการ (ต้องถูกกันออกจากหน้าแอดมิน) —");
  const refereeAllowed = ["/admin", "/admin/matches"];
  for (const p of refereeAllowed) {
    const r = await hit(p, refCookie);
    check(`${p} เข้าได้`, r.status === 200, `HTTP ${r.status}`);
  }
  for (const p of ["/admin/teams", "/admin/players", "/admin/users", "/admin/seasons", "/admin/activity"]) {
    const r = await hit(p, refCookie);
    const blocked = r.status === 307 || r.status === 302;
    check(`${p} ถูกกัน`, blocked, `HTTP ${r.status} → ${r.location ?? "-"}`);
  }

  console.log("\n— ยังไม่ล็อกอิน ต้องเด้งไปหน้า login —");
  for (const p of ["/admin", "/admin/matches", "/admin/users"]) {
    const r = await hit(p);
    const redirected = (r.status === 307 || r.status === 302) && (r.location ?? "").includes("/admin/login");
    check(`${p}`, redirected, `HTTP ${r.status} → ${r.location ?? "-"}`);
  }

  console.log("\n— ตรวจเนื้อหาสำคัญ —");
  const standings = await hit("/standings");
  check("ตารางคะแนนมีชื่อทีม", standings.body.includes("หมอลำ"));
  check("ตารางคะแนนมีหัวคอลัมน์ แต้ม", standings.body.includes("แต้ม"));
  const pendingPage = await hit(`/matches/${pendingMatch.id}`);
  check("นัดรออนุมัติแจ้งเตือนว่ายังไม่นับคะแนน", pendingPage.body.includes("รอผู้ดูแลอนุมัติ"));

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main();
