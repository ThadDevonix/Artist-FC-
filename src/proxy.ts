import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * กันหน้าที่เฉพาะแอดมินตั้งแต่ก่อนเริ่ม render
 *
 * ทำไมต้องมี: หลังบ้านมี loading.tsx ทำให้หน้าเริ่มส่งออกไป (HTTP 200) ก่อนที่ requireRole
 * ในหน้าจะทำงาน การเด้งออกจึงกลายเป็นเด้งฝั่งเบราว์เซอร์ ตรงนี้ทำให้กรรมการถูกเด้งด้วย
 * 307 จากเซิร์ฟเวอร์ทันที ส่วน requireRole ในแต่ละหน้ายังอยู่เป็นด่านที่สอง
 *
 * proxy ไม่ควรพึ่งโมดูลของแอป จึงอ่าน cookie / ตรวจ JWT เองแบบเดียวกับ src/server/auth.ts
 */
const COOKIE = "artistfc_session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;

  let role: unknown = null;
  if (token && secret) {
    try {
      role = (await jwtVerify(token, new TextEncoder().encode(secret))).payload.role;
    } catch {
      role = null;
    }
  }

  if (!role) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (role !== "ADMIN") return NextResponse.redirect(new URL("/admin?error=forbidden", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/seasons/:path*",
    "/admin/schedule/:path*",
    "/admin/teams/:path*",
    "/admin/players/:path*",
    "/admin/users/:path*",
    "/admin/officials/:path*",
    "/admin/activity/:path*",
    "/admin/export/:path*",
  ],
};
