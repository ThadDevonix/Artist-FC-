"use server";

import { db } from "@/server/db";
import { audit, requireRole } from "@/server/auth";
import { deletePhoto, uploadPhoto } from "@/server/photos";
import { idSchema, officialSchema, parseForm, type ActionState } from "@/server/validation";
import { refreshAll } from "./shared";

export async function saveOfficialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(officialSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, photoData, removePhoto, ...data } = parsed.data;

  // บัญชีหนึ่งผูกกับผู้ตัดสินได้คนเดียว ไม่งั้นจะไม่รู้ว่าล็อกอินแล้วเป็นใคร
  if (data.userId) {
    const linked = await db.official.findUnique({ where: { userId: data.userId }, select: { id: true, name: true } });
    if (linked && linked.id !== id) return { error: `บัญชีนี้ผูกกับผู้ตัดสิน "${linked.name}" อยู่แล้ว` };
  }

  const existing = id ? await db.official.findUnique({ where: { id }, select: { photoUrl: true } }) : null;
  if (id && !existing) return { error: "ไม่พบผู้ตัดสิน" };

  // รูป: อัปโหลดใหม่ > กดลบรูป > คงรูปเดิม
  let photoUrl = existing?.photoUrl ?? null;
  if (photoData) {
    try {
      photoUrl = await uploadPhoto(photoData, "officials/official");
    } catch (err) {
      return { error: err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ" };
    }
  } else if (removePhoto) {
    photoUrl = null;
  }

  if (id) {
    await db.official.update({ where: { id }, data: { ...data, photoUrl } });
    if (existing?.photoUrl !== photoUrl) await deletePhoto(existing?.photoUrl);
    await audit(session.userId, "OFFICIAL_UPDATE", "Official", id, { name: data.name });
    refreshAll();
    return { ok: "บันทึกข้อมูลผู้ตัดสินแล้ว" };
  }

  const official = await db.official.create({ data: { ...data, photoUrl } });
  await audit(session.userId, "OFFICIAL_CREATE", "Official", official.id, { name: data.name });
  refreshAll();
  return { ok: "เพิ่มผู้ตัดสินแล้ว" };
}

/** ลบผู้ตัดสิน — นัดที่เคยมีคนนี้จะว่างช่องนั้น (onDelete: SetNull) ถ้าแค่เลิกทำหน้าที่ ให้ปิด "ยังทำหน้าที่" แทน */
export async function deleteOfficialAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  const official = await db.official.delete({ where: { id: parsed.data.id } });
  await deletePhoto(official.photoUrl);
  await audit(session.userId, "OFFICIAL_DELETE", "Official", parsed.data.id);
  refreshAll();
}
