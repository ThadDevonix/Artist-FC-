"use server";

import { db } from "@/server/db";
import { audit, requireRole } from "@/server/auth";
import { idSchema, parseForm, playerSchema, type ActionState } from "@/server/validation";
import { playerSlugTaken, refreshAll, slugify, uniqueSlug } from "./shared";

export async function savePlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(playerSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, ...data } = parsed.data;

  if (id) {
    await db.player.update({ where: { id }, data });
    await audit(session.userId, "PLAYER_UPDATE", "Player", id, { name: data.name });
    refreshAll();
    return { ok: "บันทึกข้อมูลนักเตะแล้ว" };
  }

  const slug = await uniqueSlug(slugify(data.name), playerSlugTaken);
  const player = await db.player.create({ data: { ...data, slug } });
  await audit(session.userId, "PLAYER_CREATE", "Player", player.id, { name: data.name });

  refreshAll();
  return { ok: "เพิ่มนักเตะแล้ว" };
}

export async function deletePlayerAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  await db.player.delete({ where: { id: parsed.data.id } });
  await audit(session.userId, "PLAYER_DELETE", "Player", parsed.data.id);
  refreshAll();
}
