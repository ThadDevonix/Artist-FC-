/**
 * ทดสอบหน้า สโมสร/นักเตะ แบบ end-to-end ผ่าน HTTP จริง
 *   นำเข้ารายชื่อทั้งทีม → เข้าครบ · มีแถวผิด/เบอร์ซ้ำ → ไม่บันทึกเลยสักคน
 *   เพิ่มนักเตะทีละคน → เบอร์ซ้ำถูกปฏิเสธ · ไม่ระบุทีมถูกปฏิเสธ
 *   ทีมงาน → เพิ่มได้ · "อื่นๆ" ต้องพิมพ์ชื่อตำแหน่ง · แสดงบนหน้าเว็บทีม
 * ใช้ทีมชั่วคราวที่ไม่อยู่ในฤดูกาลใด (ไม่โผล่บนหน้าเว็บ) แล้วลบทิ้งทุกครั้ง
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

/** ค่า hidden ของ server action ในฟอร์มที่มีช่องชื่อ marker (ฟอร์มทำงานได้แม้ไม่มี JS) */
function actionFields(html: string, marker: string) {
  const form = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes(`name="${marker}"`));
  if (!form) throw new Error(`ไม่พบฟอร์มที่มีช่อง ${marker}`);
  const body = new FormData();
  for (const tag of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    if (!name?.startsWith("$ACTION")) continue;
    body.append(name, (/value="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  }
  return body;
}

async function login(email: string, password: string) {
  const body = actionFields(await (await fetch(`${BASE}/admin/login`)).text(), "password");
  body.append("email", email);
  body.append("password", password);
  const res = await fetch(`${BASE}/admin/login`, { method: "POST", body, redirect: "manual" });
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie.includes("artistfc_session=")) throw new Error(`ล็อกอิน ${email} ไม่สำเร็จ`);
  return cookie;
}

async function submit(path: string, cookie: string, marker: string, fields: Record<string, string>) {
  const html = await (await fetch(`${BASE}${path}`, { headers: { cookie } })).text();
  const body = actionFields(html, marker);
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  const res = await fetch(`${BASE}${path}`, { method: "POST", body, headers: { cookie }, redirect: "manual" });
  return res.text();
}

async function main() {
  const team = await db.team.create({
    data: { name: "ทีมทดสอบนำเข้า", shortName: "ทดสอบ", code: "TST", slug: `roster-test-${Date.now()}` },
  });
  const page = `/admin/teams/${team.id}`;
  const count = () => db.player.count({ where: { teamId: team.id } });

  try {
    const cookie = await login("admin@artistfc.local", "admin1234");

    console.log("\n— นำเข้ารายชื่อ —");
    const ok = await submit(page, cookie, "text", {
      teamId: team.id,
      text: "ชื่อ,เบอร์,ตำแหน่ง,สัญชาติ,วันเกิด\nทดสอบ หนึ่ง,1,GK,ไทย,1998-05-12\nทดสอบ สอง,9,กองหน้า,,12/05/2541\nทดสอบ สาม,,MF",
    });
    check("นำเข้า 3 คน", (await count()) === 3, ok.includes("นำเข้านักเตะ 3 คนแล้ว") ? "" : "(ไม่เห็นข้อความสำเร็จ)");
    const gk = await db.player.findFirst({ where: { teamId: team.id, number: 1 } });
    check("ตำแหน่ง/วันเกิดถูกต้อง", gk?.position === "GK" && gk.birthDate?.toISOString().slice(0, 10) === "1998-05-12");
    const fw = await db.player.findFirst({ where: { teamId: team.id, number: 9 } });
    check("ปี พ.ศ. แปลงเป็น ค.ศ.", fw?.position === "FW" && fw.birthDate?.toISOString().slice(0, 10) === "1998-05-12");

    const dup = await submit(page, cookie, "text", { teamId: team.id, text: "คนใหม่,20\nเบอร์ซ้ำ,9" });
    check("เบอร์ซ้ำกับในทีม → ไม่บันทึกเลยสักคน", (await count()) === 3 && dup.includes("มีคนในทีมใช้อยู่แล้ว"));

    console.log("\n— เพิ่มทีละคน —");
    const taken = await submit(page, cookie, "position", { teamId: team.id, name: "เบอร์ชน", number: "1", position: "DF", active: "on" });
    check("เบอร์ที่มีคนใช้แล้วถูกปฏิเสธ", (await count()) === 3 && taken.includes("มีคนในทีมใช้อยู่แล้ว"));

    await submit(page, cookie, "position", { teamId: team.id, name: "คนที่สี่", number: "4", position: "DF", active: "on" });
    check("เพิ่มนักเตะเข้าทีมนี้", (await count()) === 4);

    const noTeam = await submit(page, cookie, "position", { teamId: "", name: "ไร้สังกัด", position: "MF" });
    check("ไม่ระบุทีม → ถูกปฏิเสธ", !(await db.player.findFirst({ where: { name: "ไร้สังกัด" } })) && noTeam.includes("ต้องมีสังกัดทีม"));

    console.log("\n— ทีมงาน —");
    const staffPage = `${page}?tab=staff`;
    const staffCount = () => db.staff.count({ where: { teamId: team.id } });
    await submit(staffPage, cookie, "role", { teamId: team.id, name: "โค้ชทดสอบ", role: "HEAD_COACH", active: "on" });
    check("เพิ่มหัวหน้าผู้ฝึกสอน", (await staffCount()) === 1);
    const noLabel = await submit(staffPage, cookie, "role", { teamId: team.id, name: "ไม่มีชื่อตำแหน่ง", role: "OTHER", active: "on" });
    check("\"อื่นๆ\" ไม่พิมพ์ชื่อตำแหน่ง → ถูกปฏิเสธ", (await staffCount()) === 1 && noLabel.includes("กรุณาพิมพ์ชื่อตำแหน่ง"));
    await submit(staffPage, cookie, "role", { teamId: team.id, name: "นักวิเคราะห์", role: "OTHER", roleLabel: "นักวิเคราะห์เกม", active: "on" });
    const analyst = await db.staff.findFirst({ where: { teamId: team.id, role: "OTHER" } });
    check("\"อื่นๆ\" เก็บชื่อตำแหน่งที่พิมพ์", analyst?.roleLabel === "นักวิเคราะห์เกม");
    const html = await (await fetch(`${BASE}/teams/${team.slug}?pos=staff`)).text();
    check("หน้าเว็บทีมแสดงทีมงาน", html.includes("โค้ชทดสอบ") && html.includes("นักวิเคราะห์เกม"));
    check("ทีมงานไม่โผล่ในรายชื่อนักเตะ", !(await db.player.findFirst({ where: { name: "โค้ชทดสอบ" } })));
  } finally {
    const staffIds = (await db.staff.findMany({ where: { teamId: team.id }, select: { id: true } })).map((s) => s.id);
    const ids = (await db.player.findMany({ where: { teamId: team.id }, select: { id: true } })).map((p) => p.id);
    await db.auditLog.deleteMany({ where: { entityId: { in: [team.id, ...ids, ...staffIds] } } });
    await db.team.delete({ where: { id: team.id } }); // นักเตะถูกลบตาม (cascade)
    await db.$disconnect();
  }

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
