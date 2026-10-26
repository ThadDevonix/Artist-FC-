import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import type { Role } from "@/generated/prisma/enums";

const COOKIE = "artistfc_session";
const MAX_AGE = 60 * 60 * 8; // 8 ชั่วโมง

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("ต้องตั้งค่า AUTH_SECRET ในไฟล์ .env (ยาวอย่างน้อย 16 ตัวอักษร)");
  }
  return new TextEncoder().encode(value);
}

export type Session = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

/** ตรวจอีเมล/รหัสผ่าน แล้วคืน session ถ้าถูกต้อง */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<Session | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}

export async function createSession(session: Session) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** อ่าน session ปัจจุบัน — คืน null ถ้ายังไม่ล็อกอินหรือ token หมดอายุ */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.userId || !payload.role) return null;
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** บังคับให้ต้องล็อกอิน — ถ้าไม่ผ่านจะเด้งไปหน้า login */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** บังคับสิทธิ์ระดับที่ต้องการ */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect("/admin?error=forbidden");
  return session;
}

export function isAdmin(session: Session | null): boolean {
  return session?.role === "ADMIN";
}

/** บันทึกร่องรอยการแก้ไข เพื่อให้ตรวจย้อนหลังได้ว่าใครทำอะไร */
export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string,
  detail?: unknown,
) {
  await db.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      detail: detail === undefined ? null : JSON.stringify(detail),
    },
  });
}
