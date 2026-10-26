/**
 * ทดสอบการล็อกอินจริงผ่าน HTTP โดยส่งฟอร์มแบบเดียวกับที่เบราว์เซอร์ส่ง
 * (progressive enhancement ของ Next: ฟิลด์ $ACTION_* ที่ฝังอยู่ในหน้า)
 */
import "dotenv/config";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

/** ดึงฟิลด์ $ACTION_* ที่ Next ฝังไว้ในฟอร์ม เพื่อส่งฟอร์มแบบไม่มี JS */
function actionFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const re = /<input[^>]*type="hidden"[^>]*>/g;
  for (const tag of html.match(re) ?? []) {
    const name = /name="([^"]+)"/.exec(tag)?.[1];
    const value = /value="([^"]*)"/.exec(tag)?.[1] ?? "";
    if (name?.startsWith("$ACTION")) {
      fields[name] = value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    }
  }
  return fields;
}

async function attemptLogin(email: string, password: string) {
  const page = await fetch(`${BASE}/admin/login`);
  const html = await page.text();
  const fields = actionFields(html);

  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  body.append("email", email);
  body.append("password", password);

  const res = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    body,
    redirect: "manual",
  });

  const setCookie = res.headers.get("set-cookie") ?? "";
  const text = await res.text();
  return { status: res.status, setCookie, text, fields };
}

async function main() {
  console.log("\n— ล็อกอินผ่านฟอร์มจริง —");

  const good = await attemptLogin("admin@artistfc.local", "admin1234");
  check("ส่งฟอร์มได้ (พบฟิลด์ $ACTION)", Object.keys(good.fields).length > 0, `${Object.keys(good.fields).length} ฟิลด์`);
  const gotCookie = good.setCookie.includes("artistfc_session=");
  check("ล็อกอินถูกต้อง → ได้ session cookie", gotCookie, `HTTP ${good.status}`);
  check("cookie เป็น httpOnly", good.setCookie.toLowerCase().includes("httponly"));
  check("cookie เป็น SameSite=Lax", good.setCookie.toLowerCase().includes("samesite=lax"));

  if (gotCookie) {
    const cookie = good.setCookie.split(";")[0];
    const res = await fetch(`${BASE}/admin`, { headers: { cookie }, redirect: "manual" });
    check("ใช้ cookie เข้าหลังบ้านได้", res.status === 200, `HTTP ${res.status}`);
  }

  const badPass = await attemptLogin("admin@artistfc.local", "wrong-password");
  check("รหัสผ่านผิด → ไม่ได้ cookie", !badPass.setCookie.includes("artistfc_session="));
  check("รหัสผ่านผิด → แจ้งข้อความผิดพลาด", badPass.text.includes("อีเมลหรือรหัสผ่านไม่ถูกต้อง"));

  const noUser = await attemptLogin("ghost@artistfc.local", "whatever1234");
  check("ไม่มีผู้ใช้นี้ → ไม่ได้ cookie", !noUser.setCookie.includes("artistfc_session="));

  const badEmail = await attemptLogin("not-an-email", "x");
  check("อีเมลผิดรูปแบบ → แจ้งเตือน", badEmail.text.includes("รูปแบบอีเมลไม่ถูกต้อง"));

  console.log("\n— session ปลอมต้องใช้ไม่ได้ —");
  // token รูปแบบ JWT ถูกต้องแต่ลายเซ็นมั่ว
  const fake =
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(JSON.stringify({ userId: "x", email: "a@b.c", name: "ปลอม", role: "ADMIN" })).toString("base64url") +
    ".c2lnbmF0dXJlLXRoYXQtaXMtbm90LXZhbGlk";
  const forged = await fetch(`${BASE}/admin`, {
    headers: { cookie: `artistfc_session=${fake}` },
    redirect: "manual",
  });
  check(
    "token ที่เซ็นไม่ถูกต้อง ถูกปฏิเสธ (อ้างสิทธิ์ ADMIN ก็ไม่ผ่าน)",
    forged.status === 307 && (forged.headers.get("location") ?? "").includes("/admin/login"),
    `HTTP ${forged.status} → ${forged.headers.get("location")}`,
  );

  console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
