"use server";

import { db } from "@/server/db";
import { audit, requireRole } from "@/server/auth";
import { teamHasResults } from "@/server/guards";
import { idSchema, parseForm, teamSchema, type ActionState } from "@/server/validation";
import { refreshAll, slugify, teamSlugTaken, uniqueSlug } from "./shared";

export async function saveTeamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(teamSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, name, shortName, code, ...rest } = parsed.data;

  const data = {
    name,
    shortName: shortName ?? name,
    code: (code ?? name.slice(0, 3)).toUpperCase(),
    color: rest.color ?? "#1f2937",
    color2: rest.useColor2 ? (rest.color2 ?? null) : null,
    logoUrl: rest.logoUrl,
    venue: rest.venue,
    city: rest.city,
    founded: rest.founded,
  };

  if (id) {
    await db.team.update({ where: { id }, data });
    await audit(session.userId, "TEAM_UPDATE", "Team", id, { name });
    refreshAll();
    return { ok: "บันทึกข้อมูลสโมสรแล้ว" };
  }

  const slug = await uniqueSlug(slugify(name), teamSlugTaken);
  const team = await db.team.create({ data: { ...data, slug } });
  await audit(session.userId, "TEAM_CREATE", "Team", team.id, { name });

  // ใส่ทีมใหม่เข้าฤดูกาลที่กำลังใช้งานอยู่ให้เลย จะได้ไม่ต้องไปเพิ่มซ้ำอีกหน้า
  const active = await db.season.findFirst({ where: { isActive: true } });
  if (active) {
    await db.seasonTeam.create({ data: { seasonId: active.id, teamId: team.id } });
  }

  refreshAll();
  return { ok: "เพิ่มสโมสรแล้ว" };
}

export async function deleteTeamAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  // มีผลแข่งที่นับคะแนนแล้ว ลบไม่ได้ ไม่งั้นตารางคะแนนย้อนหลังจะเพี้ยน
  if (await teamHasResults(parsed.data.id)) return;

  await db.team.delete({ where: { id: parsed.data.id } });
  await audit(session.userId, "TEAM_DELETE", "Team", parsed.data.id);
  refreshAll();
}
