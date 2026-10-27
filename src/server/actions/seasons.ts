"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { audit, requireRole } from "@/server/auth";
import { teamHasResults } from "@/server/guards";
import { generateRoundRobin } from "@/lib/fixtures";
import { LOCKED_STATUSES } from "@/lib/labels";
import {
  fixtureSchema,
  idSchema,
  parseForm,
  seasonDeleteSchema,
  seasonSchema,
  seasonTeamSchema,
  zoneSchema,
  type ActionState,
} from "@/server/validation";
import { refreshAll, seasonSlugTaken, slugify, uniqueSlug } from "./shared";

export async function saveSeasonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(seasonSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { id, name, rounds, pointsWin, pointsDraw, pointsLoss, halfMinutes, startDate, endDate } = parsed.data;

  // checkbox หลายช่องชื่อเดียวกัน — zod อ่านได้ทีละค่า จึงดึงตรงจาก FormData
  const tiebreakers = formData.getAll("tiebreakers").filter((v): v is string => typeof v === "string");

  const data = {
    name,
    rounds,
    pointsWin: pointsWin ?? 3,
    pointsDraw: pointsDraw ?? 1,
    pointsLoss: pointsLoss ?? 0,
    // ฟอร์มสร้างฤดูกาลไม่มีช่องนี้ → ไม่ส่งไปเลย ให้ใช้ค่าเดิม/ค่าตั้งต้น 45 ของฐานข้อมูล
    ...(halfMinutes !== null ? { halfMinutes } : {}),
    startDate,
    endDate,
    ...(tiebreakers.length ? { tiebreakers: JSON.stringify(tiebreakers) } : {}),
  };

  if (id) {
    await db.season.update({ where: { id }, data });
    await audit(session.userId, "SEASON_UPDATE", "Season", id, { name });
    refreshAll();
    return { ok: "บันทึกการตั้งค่าฤดูกาลแล้ว" };
  }

  const slug = await uniqueSlug(slugify(name), seasonSlugTaken);
  const season = await db.season.create({ data: { ...data, slug } });
  await audit(session.userId, "SEASON_CREATE", "Season", season.id, { name });

  refreshAll();
  return { ok: "สร้างฤดูกาลแล้ว" };
}

/**
 * ลบฤดูกาล — นัด ผลแข่ง เหตุการณ์ และโซนสีของฤดูกาลนี้ถูกลบตาม (onDelete: Cascade)
 * ทีมและนักเตะไม่ถูกลบ เพราะใช้ร่วมกันได้หลายฤดูกาล
 * ต้องพิมพ์ชื่อฤดูกาลยืนยันทุกครั้ง (หน้าเว็บกันไว้แล้ว ที่นี่ตรวจซ้ำ เผื่อมีคนส่งฟอร์มตรง)
 */
export async function deleteSeasonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(seasonDeleteSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const season = await db.season.findUnique({ where: { id: parsed.data.id } });
  if (!season) return { error: "ไม่พบฤดูกาล" };

  const results = await db.match.count({ where: { seasonId: season.id, status: { in: LOCKED_STATUSES } } });
  if (parsed.data.confirmName !== season.name) {
    return { error: `พิมพ์ชื่อ "${season.name}" ให้ตรงเพื่อยืนยันการลบ` };
  }

  await db.season.delete({ where: { id: season.id } });
  await audit(session.userId, "SEASON_DELETE", "Season", season.id, { name: season.name, results });
  refreshAll();
  redirect("/admin/seasons");
}

export async function activateSeasonAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(idSchema, formData);
  if (!parsed.ok) return;

  await db.season.updateMany({ data: { isActive: false } });
  await db.season.update({ where: { id: parsed.data.id }, data: { isActive: true } });
  await audit(session.userId, "SEASON_ACTIVATE", "Season", parsed.data.id);
  refreshAll();
}

export async function toggleSeasonTeamAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(seasonTeamSchema, formData);
  if (!parsed.ok) return;
  const { seasonId, teamId } = parsed.data;

  const existing = await db.seasonTeam.findUnique({
    where: { seasonId_teamId: { seasonId, teamId } },
  });

  if (existing) {
    // มีผลแข่งในฤดูกาลนี้แล้ว เอาออกไม่ได้
    if (await teamHasResults(teamId, seasonId)) return;
    await db.seasonTeam.delete({ where: { id: existing.id } });
  } else {
    await db.seasonTeam.create({ data: { seasonId, teamId } });
  }

  await audit(session.userId, "SEASON_TEAM_TOGGLE", "Season", seasonId, { teamId });
  refreshAll();
}

/**
 * สร้างตารางแข่งแบบพบกันหมด
 * ลบเฉพาะนัดที่ยังไม่มีผล — นัดที่บันทึกผลไปแล้วจะไม่ถูกแตะต้อง
 */
export async function generateFixturesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(fixtureSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { seasonId, startDate, kickoffTime, daysBetween, rounds, shuffle } = parsed.data;

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { teams: { include: { team: true } } },
  });
  if (!season) return { error: "ไม่พบฤดูกาล" };

  const teamIds = season.teams.map((t) => t.teamId);
  if (teamIds.length < 2) return { error: "ต้องมีอย่างน้อย 2 ทีมในฤดูกาลนี้ก่อน" };

  const locked = await db.match.count({
    where: { seasonId, status: { in: LOCKED_STATUSES } },
  });
  if (locked > 0) {
    return { error: `มี ${locked} นัดที่บันทึกผลไปแล้ว — ลบผลเหล่านั้นก่อนจึงจะสร้างตารางใหม่ได้` };
  }

  const pairs = generateRoundRobin(teamIds, {
    rounds,
    ...(shuffle ? { shuffleSeed: Date.now() % 100000 } : {}),
  });

  const venues = new Map(season.teams.map((t) => [t.teamId, t.team.venue]));
  const [hh, mm] = kickoffTime.split(":").map(Number);
  const start = startDate ?? new Date();

  await db.match.deleteMany({
    where: { seasonId, status: { in: ["SCHEDULED", "POSTPONED", "CANCELLED"] } },
  });

  await db.match.createMany({
    data: pairs.map((p) => {
      const date = new Date(start);
      date.setDate(date.getDate() + (p.round - 1) * daysBetween);
      date.setHours(hh ?? 19, mm ?? 0, 0, 0);
      return {
        seasonId,
        round: p.round,
        homeTeamId: p.homeTeamId,
        awayTeamId: p.awayTeamId,
        kickoffAt: date,
        venue: venues.get(p.homeTeamId) ?? null,
        status: "SCHEDULED" as const,
      };
    }),
  });

  await db.season.update({ where: { id: seasonId }, data: { rounds } });
  await audit(session.userId, "FIXTURES_GENERATE", "Season", seasonId, {
    matches: pairs.length,
    rounds,
  });

  refreshAll();
  return { ok: `สร้างตารางแข่งแล้ว ${pairs.length} นัด` };
}

export async function saveZoneAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(zoneSchema, formData);
  if (!parsed.ok) return;
  const { id, seasonId, label, color, fromPos, toPos, _delete } = parsed.data;

  if (_delete && id) {
    await db.zone.delete({ where: { id } });
    refreshAll();
    return;
  }

  if (!label) return;

  const data = {
    seasonId,
    label,
    color: color ?? "#1d4ed8",
    fromPos: fromPos ?? 1,
    toPos: toPos ?? 1,
  };

  if (id) await db.zone.update({ where: { id }, data });
  else await db.zone.create({ data });

  await audit(session.userId, "ZONE_SAVE", "Season", seasonId, data);
  refreshAll();
}
