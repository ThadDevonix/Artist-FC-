"use server";

import { db } from "@/server/db";
import { audit, hashPassword, requireRole } from "@/server/auth";
import { isLastAdmin } from "@/server/guards";
import { idSchema, parseForm, userSchema, type ActionState } from "@/server/validation";
import { refreshAll } from "./shared";

const MIN_PASSWORD = 8;

export async function saveUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(userSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, name, email, password, role, active } = parsed.data;

  if (!id && password.length < MIN_PASSWORD) {
    return { error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` };
  }
  if (id && password && password.length < MIN_PASSWORD) {
    return { error: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` };
  }

  const duplicate = await db.user.findUnique({ where: { email } });
  if (duplicate && duplicate.id !== id) return { error: "อีเมลนี้ถูกใช้แล้ว" };

  if (id) {
    // กันไม่ให้ลดสิทธิ์หรือปิดบัญชีผู้ดูแลคนสุดท้ายจนไม่มีใครเข้าระบบได้
    if ((role !== "ADMIN" || !active) && (await isLastAdmin(id))) {
      return { error: "ต้องมีผู้ดูแลระบบที่เปิดใช้งานอย่างน้อย 1 คน" };
    }

    await db.user.update({
      where: { id },
      data: {
        email,
        name,
        role,
        active,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
    await audit(session.userId, "USER_UPDATE", "User", id, { email, role });
    refreshAll();
    return { ok: "บันทึกข้อมูลผู้ใช้แล้ว" };
  }

  const user = await db.user.create({
    data: { email, name, role, passwordHash: await hashPassword(password) },
  });
  await audit(session.userId, "USER_CREATE", "User", user.id, { email, role });

  refreshAll();
  return { ok: "เพิ่มผู้ใช้แล้ว" };
}

export async function deleteUserAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  if (parsed.data.id === session.userId) return; // ลบตัวเองไม่ได้
  if (await isLastAdmin(parsed.data.id)) return;

  await db.user.delete({ where: { id: parsed.data.id } });
  await audit(session.userId, "USER_DELETE", "User", parsed.data.id);
  refreshAll();
}
