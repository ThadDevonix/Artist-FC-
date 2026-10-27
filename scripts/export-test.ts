/**
 * ทดสอบดาวน์โหลด Excel ในหลังบ้าน ผ่าน HTTP จริง
 *   ปุ่มอยู่ในหน้าที่เกี่ยวข้อง · แต่ละชุดข้อมูลได้ไฟล์ .xlsx ที่มีชีตและหัวตารางถูกต้อง
 *   เลือกนัดที่ได้ · ไฟล์รวมมีครบทุกชีต · โหลดเฉพาะสโมสรเดียว หรือทุกสโมสรในระบบได้
 *   กรรมการและคนที่ไม่ได้ล็อกอินโหลดไม่ได้
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

async function login(email: string, password: string) {
  const html = await (await fetch(`${BASE}/admin/login`)).text();
  const form = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes('name="password"'))!;
  const body = new FormData();
  for (const tag of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (name) body.append(name, (/value="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  body.append("email", email);
  body.append("password", password);
  const res = await fetch(`${BASE}/admin/login`, { method: "POST", body, redirect: "manual" });
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function download(cookie: string, query: string) {
  const res = await fetch(`${BASE}/admin/export/download?${query}`, { headers: { cookie }, redirect: "manual" });
  if (res.status !== 200) return { res, wb: null };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return { res, wb };
}

const header = (ws: ExcelJS.Worksheet) => (ws.getRow(1).values as unknown[]).slice(1).join(",");

async function main() {
  const season = await db.season.findFirstOrThrow({ where: { isActive: true } });
  const q = (kind: string, extra = "") => `kind=${kind}&season=${encodeURIComponent(season.slug)}${extra}`;
  const cookie = await login("admin@artistfc.local", "admin1234");

  console.log("\n— ปุ่มในแต่ละหน้า —");
  const pageHas = async (path: string, text: string) =>
    (await (await fetch(`${BASE}${path}`, { headers: { cookie } })).text()).includes(text);
  check("หน้าฤดูกาล: โหลด Excel ตารางคะแนน", await pageHas("/admin/seasons", "โหลด Excel ตารางคะแนน"));
  check("หน้าบันทึกผล: โหลด Excel การแข่งขัน นัดที่ 1", await pageHas("/admin/matches?round=1", "&amp;round=1\""));
  check("หน้ารวมสโมสร: มีแค่ปุ่มสโมสร", (await pageHas("/admin/teams", "โหลด Excel สโมสร")) && !(await pageHas("/admin/teams", "โหลด Excel นักเตะ")));
  const club = await db.team.findFirstOrThrow({ where: { isPlaceholder: false } });
  check("หน้าสโมสร แท็บนักเตะ: ปุ่มนักเตะ", (await pageHas(`/admin/teams/${club.id}`, "โหลด Excel <!-- -->นักเตะ")) || (await pageHas(`/admin/teams/${club.id}`, `kind=players&amp;team=${club.id}`)));
  check("หน้าสโมสร แท็บทีมงาน: ปุ่มทีมงาน", await pageHas(`/admin/teams/${club.id}?tab=staff`, `kind=staff&amp;team=${club.id}`));

  console.log("\n— แต่ละชุดข้อมูล —");
  const clubs = await download(cookie, q("clubs"));
  check("ไฟล์ .xlsx", clubs.res.headers.get("content-type")?.includes("spreadsheetml") ?? false);
  check("ชื่อไฟล์ภาษาไทย", decodeURIComponent(clubs.res.headers.get("content-disposition") ?? "").includes(`ArtistFC ${season.name} สโมสร.xlsx`));
  const clubCount = await db.seasonTeam.count({ where: { seasonId: season.id, team: { isPlaceholder: false } } });
  const cs = clubs.wb!.getWorksheet("สโมสร")!;
  check("สโมสร: ครบทุกทีมในฤดูกาล", cs.rowCount - 1 === clubCount, `${cs.rowCount - 1}/${clubCount}`);
  check("สโมสร: หัวตาราง", header(cs).startsWith("ลำดับ,สโมสร,ชื่อย่อ,ตัวย่อ,สนามเหย้า"));

  const st = (await download(cookie, q("standings"))).wb!.getWorksheet("ตารางคะแนน")!;
  check("ตารางคะแนน: อันดับ 1 ถึง N", st.getCell("A2").value === 1 && st.rowCount - 1 >= clubCount);
  check("ตารางคะแนน: หัวตาราง", header(st).startsWith("อันดับ,สโมสร,แข่ง,ชนะ,เสมอ,แพ้,ได้,เสีย,ต่าง,แต้ม"));

  const total = await db.match.count({ where: { seasonId: season.id } });
  const all = (await download(cookie, q("matches"))).wb!.getWorksheet("การแข่งขัน")!;
  check("การแข่งขันทุกนัด", all.rowCount - 1 === total, `${all.rowCount - 1}/${total}`);
  const r1 = await db.match.count({ where: { seasonId: season.id, round: 1 } });
  const one = await download(cookie, q("matches", "&round=1"));
  const ws1 = one.wb!.getWorksheet("การแข่งขัน นัดที่ 1")!;
  check("เลือกนัดที่ 1", ws1.rowCount - 1 === r1 && decodeURIComponent(one.res.headers.get("content-disposition") ?? "").includes("นัดที่ 1"), `${ws1.rowCount - 1}/${r1}`);

  const playerCount = await db.player.count({ where: { team: { seasons: { some: { seasonId: season.id } }, isPlaceholder: false } } });
  const ps = (await download(cookie, q("players"))).wb!.getWorksheet("นักเตะ")!;
  check("นักเตะ: ครบทุกคน", ps.rowCount - 1 === playerCount, `${ps.rowCount - 1}/${playerCount}`);
  check("นักเตะ: มีสถิติของฤดูกาล", header(ps).endsWith(`ประตู ${season.name},แอสซิสต์,ใบเหลือง,ใบแดง`));

  const staffCount = await db.staff.count({ where: { team: { seasons: { some: { seasonId: season.id } }, isPlaceholder: false } } });
  const ss = (await download(cookie, q("staff"))).wb!.getWorksheet("ทีมงาน")!;
  check("ทีมงาน: ครบทุกคน", ss.rowCount - 1 === staffCount, `${ss.rowCount - 1}/${staffCount}`);

  const full = (await download(cookie, q("all"))).wb!;
  check("ไฟล์รวมมีครบ 5 ชีต", full.worksheets.map((w) => w.name).join(",") === "สโมสร,ตารางคะแนน,การแข่งขัน,นักเตะ,ทีมงาน", full.worksheets.map((w) => w.name).join(","));

  console.log("\n— ขอบเขตสโมสร —");
  const allClubs = await db.team.count({ where: { isPlaceholder: false } });
  const ac = (await download(cookie, "kind=clubs&scope=all")).wb!.getWorksheet("สโมสร")!;
  check("ทุกสโมสรในระบบ", ac.rowCount - 1 === allClubs, `${ac.rowCount - 1}/${allClubs}`);
  const team = await db.team.findFirstOrThrow({ where: { isPlaceholder: false, players: { some: {} } } });
  const teamPlayers = await db.player.count({ where: { teamId: team.id } });
  const tp = await download(cookie, `kind=players&team=${team.id}`);
  check("นักเตะสโมสรเดียว", tp.wb!.getWorksheet("นักเตะ")!.rowCount - 1 === teamPlayers, team.name);
  check("ชื่อไฟล์มีชื่อสโมสร", decodeURIComponent(tp.res.headers.get("content-disposition") ?? "").includes(`ArtistFC ${team.name} นักเตะ.xlsx`));
  check("สโมสรที่ไม่มีอยู่ → 404", (await download(cookie, "kind=players&team=nope")).res.status === 404);

  console.log("\n— สิทธิ์ —");
  const anon = await fetch(`${BASE}/admin/export/download?${q("all")}`, { redirect: "manual" });
  check("ไม่ได้ล็อกอิน → ไปหน้าล็อกอิน", anon.status === 307 && (anon.headers.get("location") ?? "").includes("/admin/login"));
  const ref = await fetch(`${BASE}/admin/export/download?${q("all")}`, { headers: { cookie: await login("referee1@artistfc.local", "referee1234") }, redirect: "manual" });
  check("กรรมการโหลดไม่ได้", ref.status !== 200, String(ref.status));
  check("ชุดข้อมูลที่ไม่รู้จัก → 400", (await download(cookie, q("passwords"))).res.status === 400);

  await db.$disconnect();
  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
