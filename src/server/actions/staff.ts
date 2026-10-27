"use server";

import { db } from "@/server/db";
import { audit, requireRole } from "@/server/auth";
import { deletePhoto, uploadPhoto } from "@/server/photos";
import { idSchema, parseForm, staffSchema, type ActionState } from "@/server/validation";
import { refreshAll } from "./shared";

export async function saveStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(staffSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, photoData, removePhoto, ...rest } = parsed.data;
  const data = { ...rest, roleLabel: rest.role === "OTHER" ? rest.roleLabel : null };

  if (!(await db.team.findUnique({ where: { id: data.teamId }, select: { id: true } }))) {
    return { error: "ไม่พบทีมที่เลือก" };
  }

  const existing = id ? await db.staff.findUnique({ where: { id }, select: { photoUrl: true } }) : null;
  if (id && !existing) return { error: "ไม่พบทีมงาน" };

  // รูป: อัปโหลดใหม่ > กดลบรูป > คงรูปเดิม
  let photoUrl = existing?.photoUrl ?? null;
  if (photoData) {
    try {
      photoUrl = await uploadPhoto(photoData, `staff/${data.teamId}`);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ" };
    }
  } else if (removePhoto) {
    photoUrl = null;
  }

  if (id) {
    await db.staff.update({ where: { id }, data: { ...data, photoUrl } });
    if (existing?.photoUrl !== photoUrl) await deletePhoto(existing?.photoUrl);
    await audit(session.userId, "STAFF_UPDATE", "Staff", id, { name: data.name });
    refreshAll();
    return { ok: "บันทึกข้อมูลทีมงานแล้ว" };
  }

  const staff = await db.staff.create({ data: { ...data, photoUrl } });
  await audit(session.userId, "STAFF_CREATE", "Staff", staff.id, { name: data.name });
  refreshAll();
  return { ok: "เพิ่มทีมงานแล้ว" };
}

export async function deleteStaffAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  const staff = await db.staff.delete({ where: { id: parsed.data.id } });
  await deletePhoto(staff.photoUrl);
  await audit(session.userId, "STAFF_DELETE", "Staff", parsed.data.id);
  refreshAll();
}
