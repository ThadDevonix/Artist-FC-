"use server";

import { db } from "@/server/db";
import { audit, requireRole } from "@/server/auth";
import { idSchema, parseForm, playerSchema, rosterImportSchema, type ActionState } from "@/server/validation";
import { markDuplicateNumbers, parseRoster, ROSTER_MAX_ROWS } from "@/lib/roster-import";
import { deletePhoto, uploadPhoto } from "@/server/photos";
import { playerSlugTaken, refreshAll, slugify, uniqueSlug } from "./shared";

/** เบอร์เสื้อที่นักเตะในทีม (ที่ยังอยู่ในทีม) ใช้อยู่ — ไม่นับคนที่กำลังแก้ไข */
async function takenNumbers(teamId: string, exceptPlayerId?: string) {
  const rows = await db.player.findMany({
    where: { teamId, active: true, number: { not: null }, ...(exceptPlayerId ? { id: { not: exceptPlayerId } } : {}) },
    select: { number: true },
  });
  return new Set(rows.map((r) => r.number!));
}

export async function savePlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(playerSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, photoData, removePhoto, ...data } = parsed.data;

  if (!(await db.team.findUnique({ where: { id: data.teamId }, select: { id: true } }))) {
    return { error: "ไม่พบทีมที่เลือก" };
  }
  if (data.active && data.number !== null && (await takenNumbers(data.teamId, id ?? undefined)).has(data.number)) {
    return { error: `เบอร์ ${data.number} มีคนในทีมใช้อยู่แล้ว` };
  }

  const existing = id ? await db.player.findUnique({ where: { id }, select: { slug: true, photoUrl: true } }) : null;
  if (id && !existing) return { error: "ไม่พบนักเตะ" };
  const slug = existing?.slug ?? (await uniqueSlug(slugify(data.name), playerSlugTaken));

  // รูป: อัปโหลดใหม่ > กดลบรูป > คงรูปเดิม
  let photoUrl = existing?.photoUrl ?? null;
  if (photoData) {
    try {
      photoUrl = await uploadPhoto(photoData, `players/${slug}`);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ" };
    }
  } else if (removePhoto) {
    photoUrl = null;
  }

  if (id) {
    await db.player.update({ where: { id }, data: { ...data, photoUrl } });
    if (existing?.photoUrl !== photoUrl) await deletePhoto(existing?.photoUrl);
    await audit(session.userId, "PLAYER_UPDATE", "Player", id, { name: data.name });
    refreshAll();
    return { ok: "บันทึกข้อมูลนักเตะแล้ว" };
  }

  const player = await db.player.create({ data: { ...data, photoUrl, slug } });
  await audit(session.userId, "PLAYER_CREATE", "Player", player.id, { name: data.name });

  refreshAll();
  return { ok: "เพิ่มนักเตะแล้ว" };
}

/**
 * นำเข้านักเตะทั้งรายชื่อเข้าทีมเดียว
 * ตรวจทุกแถวก่อน ถ้ามีแถวไหนผิดจะไม่บันทึกเลยสักคน — กันข้อมูลเข้าไปครึ่ง ๆ กลาง ๆ
 */
export async function importPlayersAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(rosterImportSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { teamId, text } = parsed.data;

  const team = await db.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (!team) return { error: "ไม่พบทีม" };

  const rows = markDuplicateNumbers(parseRoster(text), await takenNumbers(teamId));
  if (rows.length === 0) return { error: "ยังไม่มีรายชื่อให้นำเข้า" };
  if (rows.length > ROSTER_MAX_ROWS) return { error: `นำเข้าได้ครั้งละไม่เกิน ${ROSTER_MAX_ROWS} คน` };

  const bad = rows.find((r) => r.errors.length > 0);
  if (bad) return { error: `บรรทัด ${bad.line}: ${bad.errors[0]}` };

  // สร้าง slug ทั้งชุดในหน่วยความจำ แทนการถาม DB ทีละคน
  const used = new Set((await db.player.findMany({ select: { slug: true } })).map((p) => p.slug));
  const data = rows.map((r) => {
    const base = slugify(r.name);
    let slug = base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    used.add(slug);
    return {
      teamId,
      slug,
      name: r.name,
      number: r.number,
      position: r.position,
      nationality: r.nationality,
      birthDate: r.birthDate ? new Date(r.birthDate) : null,
    };
  });

  await db.player.createMany({ data });
  await audit(session.userId, "PLAYER_IMPORT", "Team", teamId, { team: team.name, count: data.length });

  refreshAll();
  return { ok: `นำเข้านักเตะ ${data.length} คนแล้ว` };
}

/** ซ่อน/แสดงนักเตะบนหน้าเว็บสาธารณะ — กดสลับจากปุ่มรูปตาในหน้าสโมสร */
export async function togglePlayerHiddenAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  const player = await db.player.findUnique({ where: { id: parsed.data.id }, select: { hidden: true, name: true } });
  if (!player) return;
  await db.player.update({ where: { id: parsed.data.id }, data: { hidden: !player.hidden } });
  await audit(session.userId, player.hidden ? "PLAYER_SHOW" : "PLAYER_HIDE", "Player", parsed.data.id, { name: player.name });
  refreshAll();
}

export async function deletePlayerAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  const player = await db.player.delete({ where: { id: parsed.data.id } });
  await deletePhoto(player.photoUrl);
  await audit(session.userId, "PLAYER_DELETE", "Player", parsed.data.id);
  refreshAll();
}
