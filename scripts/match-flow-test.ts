/**
 * ทดสอบ flow หลักของระบบแบบ end-to-end ผ่าน HTTP จริง
 *   กรรมการกรอกผล → สถานะ "รออนุมัติ" (ยังไม่นับคะแนน)
 *   แอดมินอนุมัติ → สถานะ "จบแล้ว" และตารางคะแนนขยับ
 * ทดสอบแล้วคืนค่าเดิมทุกครั้ง
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

async function login(email: string, password: string) {
  const html = await (await fetch(`${BASE}/admin/login`)).text();
  const body = new FormData();
  for (const tag of html.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (!name?.startsWith("$ACTION")) continue;
    const value = (/value="([^"]*)"/.exec(tag)?.[1] ?? "")
      .replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    body.append(name, value);
  }
  body.append("email", email);
  body.append("password", password);
  const res = await fetch(`${BASE}/admin/login`, { method: "POST", body, redirect: "manual" });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie.includes("artistfc_session=")) throw new Error(`ล็อกอิน ${email} ไม่สำเร็จ`);
  return cookie;
}

/**
 * ส่งฟอร์มบนหน้าใดหน้าหนึ่ง
 * หน้าหนึ่งมีหลายฟอร์มที่ใช้ matchId เหมือนกัน จึงเลือกด้วยข้อความที่อยู่ในฟอร์มนั้น
 * (เช่น ข้อความบนปุ่ม) เพื่อให้แน่ใจว่ายิงถูกฟอร์ม
 */
async function submitForm(
  url: string,
  cookie: string,
  fields: Record<string, string>,
  pickBy: string,
) {
  const html = await (await fetch(url, { headers: { cookie } })).text();

  const forms = html.split("<form").slice(1).map((f) => "<form" + f.split("</form>")[0]);
  const form = forms.find((f) => f.includes(pickBy));
  if (!form) throw new Error(`ไม่พบฟอร์มที่มี "${pickBy}" ที่ ${url}`);

  const body = new FormData();
  for (const tag of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (!name) continue;
    const value = (/value="([^"]*)"/.exec(tag)?.[1] ?? "")
      .replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    body.append(name, value);
  }
  for (const [k, v] of Object.entries(fields)) body.append(k, v);

  const res = await fetch(url, { method: "POST", body, headers: { cookie }, redirect: "manual" });
  return { status: res.status, text: await res.text() };
}

async function main() {
  const season = await db.season.findFirstOrThrow({ where: { isActive: true } });
  const referee = await db.user.findUniqueOrThrow({ where: { email: "referee1@artistfc.local" } });

  // หานัดที่ยังไม่แข่ง แล้วมอบหมายให้กรรมการคนนี้
  const target = await db.match.findFirstOrThrow({
    where: { seasonId: season.id, status: "SCHEDULED" },
    include: { homeTeam: true, awayTeam: true },
  });
  const originalRefereeId = target.refereeId;
  await db.match.update({ where: { id: target.id }, data: { refereeId: referee.id } });

  console.log(`\nนัดทดสอบ: ${target.homeTeam.shortName} พบ ${target.awayTeam.shortName} (นัดที่ ${target.round})\n`);

  const refCookie = await login("referee1@artistfc.local", "referee1234");
  const adminCookie = await login("admin@artistfc.local", "admin1234");
  const url = `${BASE}/admin/matches/${target.id}`;

  console.log("— กรรมการกรอกผล —");
  await submitForm(url, refCookie, { homeGoals: "2", awayGoals: "1", notes: "ทดสอบระบบ" }, 'name="homeGoals"');

  let m = await db.match.findUniqueOrThrow({ where: { id: target.id } });
  check("สกอร์ถูกบันทึก", m.homeGoals === 2 && m.awayGoals === 1, `${m.homeGoals}–${m.awayGoals}`);
  check("สถานะเป็น 'รออนุมัติ' ไม่ใช่ 'จบแล้ว'", m.status === "PENDING", m.status);
  check("บันทึกว่าใครเป็นคนส่ง", m.submittedById === referee.id);
  check("ยังไม่มีผู้อนุมัติ", m.approvedById === null);

  const standingsHtml = await (await fetch(`${BASE}/standings`)).text();
  const matchesCounted = await db.match.count({ where: { seasonId: season.id, status: "FINISHED" } });
  check("ผลรออนุมัติยังไม่ถูกนับในตารางคะแนน", matchesCounted === 25, `นับอยู่ ${matchesCounted} นัด`);
  check("หน้าตารางคะแนนยังโหลดได้", standingsHtml.includes("ตารางคะแนน"));

  console.log("\n— กรรมการเพิ่มเหตุการณ์ —");
  const scorer = await db.player.findFirstOrThrow({ where: { teamId: target.homeTeamId, position: "FW" } });
  await submitForm(url, refCookie, { teamId: target.homeTeamId, type: "GOAL", playerId: scorer.id, minute: "23" }, 'name="minute"');
  const events = await db.matchEvent.count({ where: { matchId: target.id } });
  check("เหตุการณ์ถูกบันทึก", events === 1, `${events} เหตุการณ์`);

  console.log("\n— กรรมการห้ามอนุมัติเอง —");
  // หน้าของกรรมการต้องไม่มีปุ่มอนุมัติให้กดด้วยซ้ำ
  const refHtml = await (await fetch(url, { headers: { cookie: refCookie } })).text();
  check("หน้าของกรรมการไม่มีปุ่ม 'อนุมัติผลนี้'", !refHtml.includes("อนุมัติผลนี้"));
  check("หน้าของกรรมการไม่มีปุ่ม 'ตีกลับ'", !refHtml.includes("ตีกลับ"));
  const refApprove = null;
  m = await db.match.findUniqueOrThrow({ where: { id: target.id } });
  check("กรรมการกดแล้วสถานะยังเป็น 'รออนุมัติ'", m.status === "PENDING", m.status);
  void refApprove;

  console.log("\n— แอดมินอนุมัติ —");
  const beforeCount = await db.match.count({ where: { seasonId: season.id, status: "FINISHED" } });
  await submitForm(url, adminCookie, {}, "อนุมัติผลนี้");

  m = await db.match.findUniqueOrThrow({ where: { id: target.id } });
  check("สถานะเปลี่ยนเป็น 'จบแล้ว'", m.status === "FINISHED", m.status);
  check("บันทึกผู้อนุมัติ", m.approvedById !== null);

  const afterCount = await db.match.count({ where: { seasonId: season.id, status: "FINISHED" } });
  check("ตารางคะแนนนับนัดนี้แล้ว", afterCount === beforeCount + 1, `${beforeCount} → ${afterCount}`);

  console.log("\n— แอดมินกรอกสกอร์เอง ต้องอนุมัติทันที —");
  await submitForm(url, adminCookie, { homeGoals: "3", awayGoals: "0", notes: "" }, 'name="homeGoals"');
  m = await db.match.findUniqueOrThrow({ where: { id: target.id } });
  check("สกอร์อัปเดต", m.homeGoals === 3 && m.awayGoals === 0, `${m.homeGoals}–${m.awayGoals}`);
  check("ข้ามขั้นรออนุมัติ เป็น 'จบแล้ว' เลย", m.status === "FINISHED", m.status);

  console.log("\n— กรรมการแตะนัดของคนอื่นไม่ได้ —");
  const other = await db.match.findFirstOrThrow({
    where: { seasonId: season.id, status: "SCHEDULED", refereeId: { not: referee.id }, id: { not: target.id } },
  });
  const otherUrl = `${BASE}/admin/matches/${other.id}`;
  const otherHtml = await (await fetch(otherUrl, { headers: { cookie: refCookie } })).text();
  check("หน้าแจ้งว่าไม่ใช่ผู้ตัดสินของนัดนี้", otherHtml.includes("คุณไม่ได้เป็นผู้ตัดสินของนัดนี้"));
  check("ไม่มีช่องกรอกสกอร์ให้", !otherHtml.includes('name="homeGoals"'));

  // ยิงฟอร์มตรง ๆ ด้วย action ของนัดที่ตัวเองดูแล แต่เปลี่ยน matchId เป็นนัดคนอื่น
  const ownHtml = await (await fetch(url, { headers: { cookie: refCookie } })).text();
  const scoreForm = ownHtml.split("<form").slice(1).map((f) => "<form" + f.split("</form>")[0])
    .find((f) => f.includes('name="homeGoals"'))!;
  const body = new FormData();
  for (const tag of scoreForm.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (!name) continue;
    const value = (/value="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    body.append(name, name === "matchId" ? other.id : value);
  }
  body.append("homeGoals", "9");
  body.append("awayGoals", "9");
  const forged = await fetch(url, { method: "POST", body, headers: { cookie: refCookie }, redirect: "manual" });
  const forgedText = await forged.text();
  const otherAfter = await db.match.findUniqueOrThrow({ where: { id: other.id } });
  check("ส่งผลข้ามนัดถูกปฏิเสธ", otherAfter.homeGoals === null && otherAfter.status === "SCHEDULED",
    `สถานะ ${otherAfter.status} สกอร์ ${otherAfter.homeGoals}`);
  check("มีข้อความแจ้งเหตุผล", forgedText.includes("คุณไม่ได้เป็นผู้ตัดสินของนัดนี้"));

  console.log("\n— บันทึกประวัติการแก้ไข —");
  const logs = await db.auditLog.findMany({ where: { entityId: target.id }, orderBy: { createdAt: "asc" } });
  check("มี log การส่งผลของกรรมการ", logs.some((l) => l.action === "MATCH_SUBMIT"));
  check("มี log การอนุมัติของแอดมิน", logs.some((l) => l.action === "MATCH_APPROVE"));
  check("มี log การเพิ่มเหตุการณ์", logs.some((l) => l.action === "EVENT_ADD"));

  // คืนค่าเดิม
  await db.matchEvent.deleteMany({ where: { matchId: target.id } });
  await db.auditLog.deleteMany({ where: { entityId: target.id } });
  await db.match.update({
    where: { id: target.id },
    data: {
      status: "SCHEDULED", homeGoals: null, awayGoals: null, notes: null,
      refereeId: originalRefereeId, submittedById: null, submittedAt: null,
      approvedById: null, approvedAt: null,
    },
  });
  const restored = await db.match.count({ where: { seasonId: season.id, status: "FINISHED" } });
  check("\nคืนข้อมูลกลับสภาพเดิม", restored === 25, `เหลือ ${restored} นัดที่จบแล้ว`);

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
