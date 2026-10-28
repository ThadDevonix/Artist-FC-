"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import type { MatchStatus } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { audit, requireRole } from "@/server/auth";
import { teamHasResults } from "@/server/guards";
import { koPlaceholder, koPlaceholderPrefix, syncBracket } from "@/server/bracket";
import { fixtureSummary, generateRoundRobin, scheduleRounds } from "@/lib/fixtures";
import { cupSummary, groupLetter, knockoutFixtures } from "@/lib/knockout";
import { LOCKED_STATUSES } from "@/lib/labels";
import { fromThaiDateTime, toThaiDate } from "@/lib/format";
import {
  assignSlotSchema,
  autoScheduleSchema,
  fixtureSchema,
  idSchema,
  MAX_TEAMS,
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
  const { id, name, rounds, pointsWin, pointsDraw, pointsLoss, periods, periodMinutes, startDate, endDate } = parsed.data;
  const { koSettings, extraTime, extraTimeMinutes, penalties } = parsed.data;

  // checkbox หลายช่องชื่อเดียวกัน — zod อ่านได้ทีละค่า จึงดึงตรงจาก FormData
  const tiebreakers = formData.getAll("tiebreakers").filter((v): v is string => typeof v === "string");

  const data = {
    name,
    // ฤดูกาลแบบแบ่งกลุ่ม: นัดเดียว/เหย้า-เยือนในกลุ่มเป็นโครงตาราง เปลี่ยนได้ตอนสร้างตารางใหม่เท่านั้น
    ...(formData.has("rounds") ? { rounds } : {}),
    pointsWin: pointsWin ?? 3,
    pointsDraw: pointsDraw ?? 1,
    pointsLoss: pointsLoss ?? 0,
    // เว้นว่าง → ไม่ส่งไปเลย ให้ใช้ค่าเดิม/ค่าตั้งต้นของฐานข้อมูล (2 ครึ่ง × 45 นาที)
    ...(periods !== null ? { periods } : {}),
    ...(periodMinutes !== null ? { periodMinutes } : {}),
    ...(koSettings ? { extraTime, penalties, ...(extraTimeMinutes !== null ? { extraTimeMinutes } : {}) } : {}),
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

  // ลีกเว้นจำนวนทีมได้ (สร้างตารางทีหลัง) · แบบแบ่งกลุ่มต้องกำหนดกลุ่มตั้งแต่แรก
  const plan = fixturePlan(parsed.data, { required: parsed.data.format === "CUP" });
  if ("error" in plan) return { error: plan.error };

  const slug = await uniqueSlug(slugify(name), seasonSlugTaken);
  // ใส่จำนวนทีมมาด้วย → สร้างช่อง "ทีม 1 … ทีม N" แล้วจับคู่ตารางทั้งฤดูกาลเลย (วันเวลาตั้งทีหลัง)
  const season = await db.$transaction(
    async (tx) => {
      const created = await tx.season.create({ data: { ...data, slug, format: parsed.data.format } });
      if (plan.teamCount) {
        await addSlots(tx, created.id, range(1, plan.teamCount));
        await buildFixtures(tx, created.id, plan, false);
      }
      return created;
    },
    { timeout: 30_000 },
  );
  await audit(session.userId, "SEASON_CREATE", "Season", season.id, { name, teamCount: plan.teamCount, format: parsed.data.format });

  refreshAll();
  redirect(`/admin/seasons?season=${encodeURIComponent(season.slug)}`);
}

// ───────────────────────────── รูปแบบการแข่ง ─────────────────────────────

/** วิธีจับคู่ตาราง — ลีกพบกันหมด หรือแบ่งกลุ่มแล้วต่อน็อคเอาต์ */
type FixturePlan =
  | { format: "LEAGUE"; teamCount: number | null; rounds: 1 | 2 }
  | {
      format: "CUP";
      teamCount: number;
      rounds: 1 | 2;
      groupCount: number;
      groupSize: number;
      advancePerGroup: number;
      knockoutLegs: 1 | 2;
    };

/** อ่านรูปแบบจากฟอร์ม — required = ต้องมีจำนวนทีม (ฟอร์มสร้างตารางใหม่ / ฤดูกาลแบบแบ่งกลุ่ม) */
function fixturePlan(
  d: {
    format: "LEAGUE" | "CUP";
    rounds: number;
    teamCount: number | null;
    groupCount: number | null;
    groupSize: number | null;
    advancePerGroup: number | null;
    knockoutLegs: 1 | 2;
  },
  { required }: { required: boolean },
): FixturePlan | { error: string } {
  const rounds = (d.rounds === 2 ? 2 : 1) as 1 | 2;
  if (d.format === "LEAGUE") {
    if (required && !d.teamCount) return { error: "กรุณากรอกจำนวนทีม" };
    return { format: "LEAGUE", teamCount: d.teamCount, rounds };
  }
  if (!d.groupCount || !d.groupSize) return { error: "กรุณากรอกจำนวนกลุ่มและจำนวนทีมต่อกลุ่ม" };
  const config = {
    groupCount: d.groupCount,
    groupSize: d.groupSize,
    advancePerGroup: d.advancePerGroup ?? 2,
    rounds,
    knockoutLegs: d.knockoutLegs,
  };
  const summary = cupSummary(config);
  if (!summary.ok) return { error: summary.error };
  if (summary.teams > MAX_TEAMS) return { error: `รวมแล้ว ${summary.teams} ทีม — ได้ไม่เกิน ${MAX_TEAMS} ทีม` };
  return { format: "CUP", teamCount: summary.teams, ...config };
}

// ───────────────────────────── ช่องทีม (ทีม 1 … ทีม N) ─────────────────────────────

type Tx = Prisma.TransactionClient;

/** สถานะนัดที่สร้างตารางใหม่ทับได้ */
const UNPLAYED: MatchStatus[] = ["SCHEDULED", "POSTPONED", "CANCELLED"];

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** สร้างทีมชั่วคราว "ทีม n" ของแต่ละช่อง แล้วผูกเข้าฤดูกาล */
async function addSlots(tx: Tx, seasonId: string, slots: number[]) {
  if (slots.length === 0) return;
  const stamp = Date.now().toString(36);
  const teams = await tx.team.createManyAndReturn({
    data: slots.map((slot) => ({
      name: `ทีม ${slot}`,
      shortName: `ทีม ${slot}`,
      code: `T${slot}`,
      slug: `slot-${seasonId}-${slot}-${stamp}`,
      color: "#9ca3af",
      isPlaceholder: true,
    })),
    select: { id: true, code: true },
  });
  await tx.seasonTeam.createMany({
    data: teams.map((t) => ({ seasonId, teamId: t.id, slot: Number(t.code.slice(1)) })),
  });
}

/**
 * ย้ายทุกนัด (และเหตุการณ์ในนัด) ของฤดูกาลจากทีม from ไปเป็นทีม to
 * ใช้ตอนใส่สโมสรจริงลงช่อง หรือเอาสโมสรออกแล้วคืนเป็นช่องว่าง — คู่และวันเวลาในตารางคงเดิม
 */
async function moveFixtures(tx: Tx, seasonId: string, from: string, to: string) {
  await tx.match.updateMany({ where: { seasonId, homeTeamId: from }, data: { homeTeamId: to } });
  await tx.match.updateMany({ where: { seasonId, awayTeamId: from }, data: { awayTeamId: to } });
  await tx.matchEvent.updateMany({ where: { teamId: from, match: { seasonId } }, data: { teamId: to } });

  // นัดเหย้าที่ยังไม่มีสนาม ใช้สนามเหย้าของสโมสร
  const team = await tx.team.findUnique({ where: { id: to }, select: { venue: true } });
  if (team?.venue) {
    await tx.match.updateMany({
      where: { seasonId, homeTeamId: to, venue: null, status: { in: UNPLAYED } },
      data: { venue: team.venue },
    });
  }
}

/** ใส่สโมสร teamId ลงช่องที่ตอนนี้เป็นทีมชั่วคราว แล้วลบทีมชั่วคราวทิ้ง */
async function fillSlot(tx: Tx, entry: { id: string; seasonId: string; teamId: string }, teamId: string) {
  await moveFixtures(tx, entry.seasonId, entry.teamId, teamId);
  await tx.seasonTeam.update({ where: { id: entry.id }, data: { teamId } });
  await tx.team.delete({ where: { id: entry.teamId } });
}

/** เรียงเลขช่องใหม่ให้เป็น 1 … N ไม่มีรู (ทีมที่ยังไม่มีเลขช่องต่อท้าย) */
async function renumberSlots(tx: Tx, seasonId: string) {
  const entries = await tx.seasonTeam.findMany({
    where: { seasonId },
    orderBy: [{ slot: "asc" }, { id: "asc" }],
    select: { id: true, slot: true },
  });
  for (const [i, e] of entries.entries()) {
    if (e.slot !== i + 1) await tx.seasonTeam.update({ where: { id: e.id }, data: { slot: i + 1 } });
  }
  return entries.length;
}

/**
 * ตั้งชื่อช่องว่างให้ตรงรูปแบบ — ลีก "ทีม 3" · แบ่งกลุ่ม "ทีม B2" (ทีมที่ 2 ของกลุ่ม B)
 * สโมสรจริงไม่ถูกเปลี่ยนชื่อ
 */
async function renameSlots(tx: Tx, seasonId: string) {
  const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId }, select: { format: true } });
  const entries = await tx.seasonTeam.findMany({
    where: { seasonId },
    orderBy: [{ slot: "asc" }, { id: "asc" }],
    select: { slot: true, group: true, team: { select: { id: true, isPlaceholder: true } } },
  });
  const seen = new Map<number, number>();
  for (const e of entries) {
    const inGroup = (seen.get(e.group ?? 0) ?? 0) + 1;
    seen.set(e.group ?? 0, inGroup);
    if (!e.team.isPlaceholder) continue;
    const label = season.format === "CUP" && e.group ? `${groupLetter(e.group)}${inGroup}` : `${e.slot}`;
    await tx.team.update({
      where: { id: e.team.id },
      data: { name: `ทีม ${label}`, shortName: `ทีม ${label}`, code: season.format === "CUP" ? label : `T${label}` },
    });
  }
}

/** จับคู่ตารางใหม่จากทีมในฤดูกาลตามลำดับช่อง — ยังไม่กำหนดวันเวลา */
async function buildFixtures(tx: Tx, seasonId: string, plan: FixturePlan, shuffle: boolean) {
  const entries = await tx.seasonTeam.findMany({
    where: { seasonId },
    orderBy: [{ slot: "asc" }, { id: "asc" }],
    include: { team: { select: { venue: true } } },
  });
  const venues = new Map(entries.map((e) => [e.teamId, e.team.venue]));
  const seed = shuffle ? { shuffleSeed: Date.now() % 100000 } : {};

  // นัดเดิมที่ยังไม่แข่ง + ทีมชั่วคราวในสายน็อคเอาต์เดิม (เช่น "ที่ 1 กลุ่ม A") ทิ้งทั้งหมดแล้วสร้างใหม่
  await tx.match.deleteMany({ where: { seasonId, status: { in: UNPLAYED } } });
  await tx.team.deleteMany({ where: { slug: { startsWith: koPlaceholderPrefix(seasonId) }, isPlaceholder: true } });

  const row = (p: { round: number; homeTeamId: string; awayTeamId: string }) => ({
    seasonId,
    round: p.round,
    homeTeamId: p.homeTeamId,
    awayTeamId: p.awayTeamId,
    kickoffAt: null,
    venue: venues.get(p.homeTeamId) ?? null,
    status: "SCHEDULED" as const,
  });

  if (plan.format === "LEAGUE") {
    const pairs = generateRoundRobin(entries.map((e) => e.teamId), { rounds: plan.rounds, ...seed });
    await tx.seasonTeam.updateMany({ where: { seasonId }, data: { group: null } });
    await renameSlots(tx, seasonId);
    await tx.match.createMany({ data: pairs.map(row) });
    await tx.season.update({ where: { id: seasonId }, data: { format: "LEAGUE", rounds: plan.rounds, groupCount: 0 } });
    return pairs.length;
  }

  // แบ่งกลุ่มตามลำดับช่อง: ช่อง 1–4 กลุ่ม A, 5–8 กลุ่ม B … (สุ่มแล้วก็ยังแบ่งแบบนี้ แต่ลำดับจับคู่ในกลุ่มสุ่ม)
  for (const [i, e] of entries.entries()) {
    await tx.seasonTeam.update({ where: { id: e.id }, data: { group: Math.floor(i / plan.groupSize) + 1 } });
  }
  await renameSlots(tx, seasonId);

  const groupMatches = [];
  for (let g = 1; g <= plan.groupCount; g++) {
    const ids = entries.slice((g - 1) * plan.groupSize, g * plan.groupSize).map((e) => e.teamId);
    groupMatches.push(...generateRoundRobin(ids, { rounds: plan.rounds, ...seed }).map((p) => ({ ...row(p), group: g })));
  }
  await tx.match.createMany({ data: groupMatches });

  // สายน็อคเอาต์ทั้งหมด สร้างไว้ก่อนด้วยทีมชั่วคราว แล้วค่อยใส่ทีมจริงเมื่อรู้ผล (syncBracket)
  const lastGroupRound = Math.max(...groupMatches.map((m) => m.round));
  const ko = knockoutFixtures(plan, lastGroupRound + 1);
  const placeholders = new Map<string, string>();
  for (const source of new Set(ko.flatMap((f) => [f.homeSource, f.awaySource]))) {
    placeholders.set(source, await koPlaceholder(tx, seasonId, source));
  }
  await tx.match.createMany({
    data: ko.map((f) => ({
      seasonId,
      round: f.round,
      koSize: f.koSize,
      koSlot: f.koSlot,
      leg: f.leg,
      homeSource: f.homeSource,
      awaySource: f.awaySource,
      homeTeamId: placeholders.get(f.homeSource)!,
      awayTeamId: placeholders.get(f.awaySource)!,
      kickoffAt: null,
      status: "SCHEDULED" as const,
    })),
  });

  await tx.season.update({
    where: { id: seasonId },
    data: {
      format: "CUP",
      rounds: plan.rounds,
      groupCount: plan.groupCount,
      advancePerGroup: plan.advancePerGroup,
      knockoutLegs: plan.knockoutLegs,
    },
  });
  return groupMatches.length + ko.length;
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

  // ทีมชั่วคราว ("ทีม 3") เป็นของฤดูกาลนี้เท่านั้น ลบตามไปด้วย
  const slots = await db.seasonTeam.findMany({
    where: { seasonId: season.id, team: { isPlaceholder: true } },
    select: { teamId: true },
  });
  await db.season.delete({ where: { id: season.id } });
  await db.team.deleteMany({ where: { id: { in: slots.map((s) => s.teamId) }, isPlaceholder: true } });
  await db.team.deleteMany({ where: { slug: { startsWith: koPlaceholderPrefix(season.id) }, isPlaceholder: true } });
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

/**
 * เพิ่ม/เอาสโมสรออกจากฤดูกาล
 * - เพิ่ม: ถ้ายังมีช่องว่าง ("ทีม 3") ใส่ลงช่องแรกที่ว่าง — นัดของช่องนั้นกลายเป็นของสโมสรนี้
 * - เอาออก: ถ้ามีนัดในตารางแล้ว คืนเป็นช่องว่างแทน ตารางจะได้ไม่ขาดคู่
 */
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
    const hasFixtures = await db.match.count({
      where: { seasonId, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    });
    await db.$transaction(async (tx) => {
      if (!hasFixtures) {
        await tx.seasonTeam.delete({ where: { id: existing.id } });
        await renumberSlots(tx, seasonId);
        return;
      }
      const slot = existing.slot ?? (await renumberSlots(tx, seasonId));
      const placeholderId = await addSlotTeam(tx, existing.id, slot);
      await moveFixtures(tx, seasonId, teamId, placeholderId);
      await renameSlots(tx, seasonId);
    });
  } else {
    const team = await db.team.findUnique({ where: { id: teamId }, select: { isPlaceholder: true } });
    if (!team || team.isPlaceholder) return;
    const free = await db.seasonTeam.findFirst({
      where: { seasonId, team: { isPlaceholder: true } },
      orderBy: { slot: "asc" },
    });
    // แบบแบ่งกลุ่ม: ทีมต้องลงช่องในกลุ่มเท่านั้น เต็มแล้วเพิ่มไม่ได้ (ต้องสร้างตารางใหม่ให้มีช่องเพิ่ม)
    const season = await db.season.findUnique({ where: { id: seasonId }, select: { format: true } });
    if (!free && season?.format === "CUP") return;
    await db.$transaction(async (tx) => {
      if (free) return fillSlot(tx, free, teamId);
      const last = await tx.seasonTeam.aggregate({ where: { seasonId }, _max: { slot: true } });
      await tx.seasonTeam.create({ data: { seasonId, teamId, slot: (last._max.slot ?? 0) + 1 } });
    });
  }

  await syncBracket(seasonId);
  await audit(session.userId, "SEASON_TEAM_TOGGLE", "Season", seasonId, { teamId });
  refreshAll();
}

/** สร้างทีมชั่วคราว "ทีม slot" มาแทนที่ในแถว seasonTeam นี้ (ยังไม่ย้ายนัด) — คืนรหัสทีมชั่วคราว */
async function addSlotTeam(tx: Tx, seasonTeamId: string, slot: number) {
  const entry = await tx.seasonTeam.findUniqueOrThrow({ where: { id: seasonTeamId } });
  const placeholder = await tx.team.create({
    data: {
      name: `ทีม ${slot}`,
      shortName: `ทีม ${slot}`,
      code: `T${slot}`,
      slug: `slot-${entry.seasonId}-${slot}-${Date.now().toString(36)}`,
      color: "#9ca3af",
      isPlaceholder: true,
    },
  });
  await tx.seasonTeam.update({ where: { id: seasonTeamId }, data: { teamId: placeholder.id, slot } });
  return placeholder.id;
}

/** เลือกสโมสรใส่ลงช่องที่ระบุ (เช่น ทีม 3 → ลำปาง เอฟซี) */
export async function assignSlotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(assignSlotSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { seasonTeamId, teamId } = parsed.data;

  const entry = await db.seasonTeam.findUnique({ where: { id: seasonTeamId }, include: { team: true } });
  if (!entry) return { error: "ไม่พบช่องทีม" };
  if (!entry.team.isPlaceholder) return { error: "ช่องนี้มีสโมสรอยู่แล้ว" };

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team || team.isPlaceholder) return { error: "ไม่พบสโมสร" };
  const taken = await db.seasonTeam.findUnique({ where: { seasonId_teamId: { seasonId: entry.seasonId, teamId } } });
  if (taken) return { error: `${team.name} อยู่ในฤดูกาลนี้แล้ว` };

  await db.$transaction((tx) => fillSlot(tx, entry, teamId));
  await syncBracket(entry.seasonId);
  await audit(session.userId, "SEASON_SLOT_ASSIGN", "Season", entry.seasonId, { slot: entry.slot, teamId });
  refreshAll();
  return { ok: `${entry.team.name} → ${team.name} แล้ว` };
}

/**
 * สร้างตารางแข่งใหม่ทั้งฤดูกาล ตามจำนวนทีมที่กรอก — ยังไม่กำหนดวันเวลา (ตั้งที่หน้าจัดวันเวลาแข่ง)
 * จำนวนทีมมากกว่าที่มี → เพิ่มช่องว่าง "ทีม n" · น้อยกว่า → ลบช่องว่างท้าย ๆ ออก (สโมสรจริงไม่ถูกลบ)
 * ลบเฉพาะนัดที่ยังไม่มีผล
 */
export async function generateFixturesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("ADMIN");

  const parsed = parseForm(fixtureSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { seasonId, shuffle } = parsed.data;
  const plan = fixturePlan(parsed.data, { required: true });
  if ("error" in plan) return { error: plan.error };
  const teamCount = plan.teamCount!;

  const season = await db.season.findUnique({
    where: { id: seasonId },
    include: { teams: { include: { team: { select: { isPlaceholder: true } } }, orderBy: [{ slot: "desc" }] } },
  });
  if (!season) return { error: "ไม่พบฤดูกาล" };

  const locked = await db.match.count({
    where: { seasonId, status: { in: [...LOCKED_STATUSES, "LIVE"] } },
  });
  if (locked > 0) {
    return { error: `มี ${locked} นัดที่แข่งหรือบันทึกผลไปแล้ว — ลบผลเหล่านั้นก่อนจึงจะสร้างตารางใหม่ได้` };
  }

  const current = season.teams.length;
  const placeholders = season.teams.filter((t) => t.team.isPlaceholder); // ช่องท้าย ๆ ก่อน
  const clubs = current - placeholders.length;
  if (teamCount < clubs) {
    return { error: `ฤดูกาลนี้มีสโมสรแล้ว ${clubs} ทีม — เอาสโมสรออกก่อน หรือใส่จำนวนทีมอย่างน้อย ${clubs}` };
  }

  const total = await db.$transaction(
    async (tx) => {
      // ลบนัดเก่าก่อน — ลบทีมชั่วคราวแล้วนัดของทีมนั้นจะถูกลบตาม (cascade) อยู่ดี
      await tx.match.deleteMany({ where: { seasonId, status: { in: UNPLAYED } } });
      if (teamCount < current) {
        const drop = placeholders.slice(0, current - teamCount).map((t) => t.teamId);
        await tx.team.deleteMany({ where: { id: { in: drop }, isPlaceholder: true } });
      }
      const count = await renumberSlots(tx, seasonId);
      await addSlots(tx, seasonId, range(count + 1, teamCount));
      return buildFixtures(tx, seasonId, plan, shuffle);
    },
    { timeout: 30_000 },
  );

  await audit(session.userId, "FIXTURES_GENERATE", "Season", seasonId, { matches: total, rounds: plan.rounds, teamCount, format: plan.format });
  refreshAll();
  if (plan.format === "CUP") {
    return { ok: `สร้างตารางแล้ว ${plan.groupCount} กลุ่ม + สายน็อคเอาต์ (${total} คู่) — ตั้งวันเวลาได้ที่หน้าจัดวันเวลาแข่ง` };
  }
  const { totalRounds } = fixtureSummary(teamCount, plan.rounds);
  return { ok: `สร้างตารางแล้ว ${totalRounds} นัด (${total} คู่) — ตั้งวันเวลาได้ที่หน้าจัดวันเวลาแข่ง` };
}

/**
 * ตั้งวันเวลาให้ทุกคู่ที่ยังไม่แข่งแบบอัตโนมัติ (1 นัดต่อสัปดาห์ กระจายลงวันที่เลือก)
 * นัดแรกที่ยังไม่แข่งเริ่มในสัปดาห์ของวันเริ่ม นัดถัดไปเลื่อนไปทีละสัปดาห์
 */
export async function autoScheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(autoScheduleSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { seasonId, startDate, kickoffTimes, weeksBetween } = parsed.data;

  // checkbox หลายช่องชื่อเดียวกัน — zod อ่านได้ทีละค่า จึงดึงตรงจาก FormData (0 = อาทิตย์ … 6 = เสาร์)
  const weekdays = formData
    .getAll("weekdays")
    .map((v) => Number(v))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (weekdays.length === 0) return { error: "กรุณาเลือกวันที่แข่งอย่างน้อย 1 วัน" };

  const matches = await db.match.findMany({
    where: { seasonId, status: { in: ["SCHEDULED", "POSTPONED"] } },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { id: true, round: true },
  });
  if (matches.length === 0) return { error: "ไม่มีนัดที่ยังไม่แข่ง — สร้างตารางที่หน้าฤดูกาลก่อน" };

  // นับสัปดาห์จากนัดแรกที่ยังไม่แข่ง (ฤดูกาลที่แข่งไปแล้วครึ่งทางจะได้ไม่ถูกเลื่อนไปไกล)
  const first = matches[0].round;
  const pairs = matches.map((m) => ({ id: m.id, round: m.round - first + 1 }));
  // คิดวันเวลาตามเวลาไทย (เซิร์ฟเวอร์บน Vercel เป็น UTC — setHours จะเพี้ยน 7 ชม.)
  const startYmd = toThaiDate(startDate ?? new Date());
  const kickoff = scheduleRounds(pairs, { startYmd, weekdays, times: kickoffTimes, weeksBetween });

  await db.$transaction(
    pairs.map((p) => {
      const [date, time] = kickoff.get(p)!;
      return db.match.update({ where: { id: p.id }, data: { kickoffAt: fromThaiDateTime(date, time) } });
    }),
  );
  await audit(session.userId, "MATCH_AUTO_SCHEDULE", "Season", seasonId, { matches: pairs.length });
  refreshAll();
  return { ok: `ตั้งวันเวลาแล้ว ${pairs.length} คู่` };
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
