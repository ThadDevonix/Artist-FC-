"use server";

import { db } from "@/server/db";
import { audit, requireRole, requireSession, type Session } from "@/server/auth";
import { loadEditableMatch } from "@/server/guards";
import { scoreFromEvents, syncLiveScore } from "@/server/live";
import { fromThaiDateTime } from "@/lib/format";
import {
  matchDetailSchema,
  livePhaseSchema,
  matchIdSchema,
  matchResultSchema,
  parseForm,
  type ActionState,
} from "@/server/validation";
import { refreshAll } from "./shared";

/**
 * บันทึกผลการแข่งขัน
 *
 * กรรมการบันทึก → สถานะ "รออนุมัติ" ยังไม่ถูกนับในตารางคะแนน
 * ผู้ดูแลบันทึกเอง → ถือว่าอนุมัติทันที
 */
export async function saveMatchResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = parseForm(matchResultSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { matchId, homeGoals, awayGoals, notes } = parsed.data;

  const access = await loadEditableMatch(session, matchId);
  if (!access.ok) return { error: access.error };

  return recordResult(session, matchId, homeGoals, awayGoals, notes);
}

/** บันทึกผลจริง — ใช้ทั้งฟอร์มกรอกสกอร์และปุ่ม "จบเกม" ของโหมดถ่ายทอดสด */
async function recordResult(
  session: Session,
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  notes?: string | null,
): Promise<ActionState> {
  const isAdmin = session.role === "ADMIN";
  const now = new Date();

  await db.match.update({
    where: { id: matchId },
    data: {
      homeGoals,
      awayGoals,
      ...(notes !== undefined ? { notes } : {}),
      status: isAdmin ? "FINISHED" : "PENDING",
      livePhase: null,
      phaseStartedAt: null,
      submittedById: session.userId,
      submittedAt: now,
      ...(isAdmin
        ? { approvedById: session.userId, approvedAt: now }
        : { approvedById: null, approvedAt: null }),
    },
  });

  await audit(
    session.userId,
    isAdmin ? "MATCH_SAVE_APPROVED" : "MATCH_SUBMIT",
    "Match",
    matchId,
    { homeGoals, awayGoals },
  );

  refreshAll();
  return { ok: isAdmin ? "บันทึกและอนุมัติผลแล้ว" : "ส่งผลให้ผู้ดูแลอนุมัติแล้ว" };
}

/** เริ่มถ่ายทอดสด — สถานะ "กำลังแข่ง" สกอร์เริ่ม 0–0 แล้วนับจากเหตุการณ์ประตูเอง */
export async function startLiveAction(formData: FormData) {
  const session = await requireSession();
  const parsed = parseForm(matchIdSchema, formData);
  if (!parsed.ok) return;

  const access = await loadEditableMatch(session, parsed.data.matchId);
  if (!access.ok || !["SCHEDULED", "POSTPONED"].includes(access.match.status)) return;

  // เวลาเตะในโปรแกรมเปลี่ยนเป็นเวลาที่กดจริง (นัดเลท/เตะก่อน) — เวลาเดิมที่แจ้งไว้เก็บในประวัติการแก้ไข
  const now = new Date();
  await db.match.update({
    where: { id: access.match.id },
    data: { status: "LIVE", livePhase: "FIRST_HALF", phaseStartedAt: now, kickoffAt: now },
  });
  await syncLiveScore(access.match.id);
  await audit(session.userId, "MATCH_LIVE_START", "Match", access.match.id, {
    scheduledKickoff: access.match.kickoffAt?.toISOString() ?? null,
    actualKickoff: now.toISOString(),
  });
  refreshAll();
}

/** พักครึ่ง / เริ่มครึ่งหลัง — นาฬิกานับใหม่จากเวลาที่กด */
export async function setLivePhaseAction(formData: FormData) {
  const session = await requireSession();
  const parsed = parseForm(livePhaseSchema, formData);
  if (!parsed.ok) return;

  const access = await loadEditableMatch(session, parsed.data.matchId);
  if (!access.ok || access.match.status !== "LIVE") return;

  await db.match.update({
    where: { id: access.match.id },
    data: { livePhase: parsed.data.phase, phaseStartedAt: new Date() },
  });
  await audit(session.userId, "MATCH_LIVE_PHASE", "Match", access.match.id, { phase: parsed.data.phase });
  refreshAll();
}

/**
 * จบเกม — ใช้สกอร์ที่นับจากเหตุการณ์เป็นผลการแข่งขัน ไม่ต้องกรอกซ้ำ
 * แอดมินกด = อนุมัติทันที (เข้าตารางคะแนน) · กรรมการกด = ส่งให้แอดมินอนุมัติ
 */
export async function finishLiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = parseForm(matchIdSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const access = await loadEditableMatch(session, parsed.data.matchId);
  if (!access.ok) return { error: access.error };
  if (access.match.status !== "LIVE") return { error: "นัดนี้ไม่ได้อยู่ระหว่างถ่ายทอดสด" };

  const score = await scoreFromEvents(access.match.id);
  if (!score) return { error: "ไม่พบนัดนี้" };
  return recordResult(session, access.match.id, score.homeGoals, score.awayGoals);
}

export async function approveMatchAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(matchIdSchema, formData);
  if (!parsed.ok) return;

  const match = await db.match.findUnique({ where: { id: parsed.data.matchId } });
  if (!match || match.homeGoals === null || match.awayGoals === null) return;

  await db.match.update({
    where: { id: match.id },
    data: { status: "FINISHED", approvedById: session.userId, approvedAt: new Date() },
  });
  await audit(session.userId, "MATCH_APPROVE", "Match", match.id);
  refreshAll();
}

/** ตีกลับผลที่กรรมการส่งมา — ล้างสกอร์แล้วคืนสถานะเป็นยังไม่แข่ง */
export async function rejectMatchAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(matchIdSchema, formData);
  if (!parsed.ok) return;

  await db.match.update({
    where: { id: parsed.data.matchId },
    data: {
      status: "SCHEDULED",
      homeGoals: null,
      awayGoals: null,
      approvedById: null,
      approvedAt: null,
      submittedById: null,
      submittedAt: null,
    },
  });
  await audit(session.userId, "MATCH_REJECT", "Match", parsed.data.matchId, {
    reason: parsed.data.reason ?? null,
  });
  refreshAll();
}

/** แก้วันเวลา สนาม ทีมผู้ตัดสิน และสถานะ — เฉพาะผู้ดูแลระบบ */
export async function updateMatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(matchDetailSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { matchId, kickoffAt, venue, refereeId, assistant1Id, assistant2Id, fourthOfficialId, status } = parsed.data;

  const before = await db.match.findUnique({ where: { id: matchId }, select: { status: true } });
  // เลิกถ่ายทอด (กลับไปยังไม่แข่ง/เลื่อน/ยกเลิก) ต้องล้างสกอร์สด ไม่งั้นหน้าเว็บจะโชว์สกอร์ของเกมที่ยังไม่ได้แข่ง
  const leftLive = before?.status === "LIVE" && status && ["SCHEDULED", "POSTPONED", "CANCELLED"].includes(status);

  await db.match.update({
    where: { id: matchId },
    data: {
      ...(kickoffAt ? { kickoffAt } : {}),
      venue,
      refereeId,
      assistant1Id,
      assistant2Id,
      fourthOfficialId,
      ...(status ? { status } : {}),
      ...(leftLive ? { homeGoals: null, awayGoals: null, livePhase: null, phaseStartedAt: null } : {}),
      // ตั้งเป็น "กำลังแข่ง" จากฟอร์มนี้โดยตรง (ไม่ผ่านปุ่มเริ่มถ่ายทอด) → เริ่มนาฬิกาครึ่งแรกให้
      ...(status === "LIVE" && before?.status !== "LIVE" ? { livePhase: "FIRST_HALF" as const, phaseStartedAt: new Date() } : {}),
    },
  });
  await syncLiveScore(matchId);
  await audit(session.userId, "MATCH_UPDATE", "Match", matchId);
  refreshAll();
  return { ok: "บันทึกรายละเอียดนัดแล้ว" };
}

/**
 * จัดวันเวลา/สนามของหลายนัดพร้อมกัน (หน้า "จัดวันเวลาแข่ง")
 * แต่ละคู่ในนัดเดียวกันแข่งคนละวันได้ — ฟอร์มส่งมาเป็น date_<id>, time_<id>, venue_<id> (วันเวลาเว้นว่างได้)
 * ไม่แตะนัดที่กำลังถ่ายทอดสด (เวลาเตะของนัดนั้นถูกบันทึกตอนกดเริ่มแล้ว)
 */
export async function saveScheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole("ADMIN");
  const ids = formData.getAll("matchId").filter((v): v is string => typeof v === "string");
  if (ids.length === 0) return { error: "ไม่มีนัดให้บันทึก" };

  const matches = await db.match.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
  const updates = [];
  for (const m of matches) {
    if (m.status === "LIVE") continue;
    const date = String(formData.get(`date_${m.id}`) ?? "").trim();
    const time = String(formData.get(`time_${m.id}`) ?? "").trim();
    const venue = String(formData.get(`venue_${m.id}`) ?? "").trim();
    // เว้นว่างทั้งวันและเวลา = ยังไม่กำหนด · กรอกแค่ช่องเดียวไม่ได้
    const unset = !date && !time;
    if (!unset && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))) {
      return { error: "กรอกทั้งวันและเวลา หรือเว้นว่างทั้งคู่ถ้ายังไม่กำหนด" };
    }
    updates.push(
      db.match.update({
        where: { id: m.id },
        data: { kickoffAt: unset ? null : fromThaiDateTime(date, time), venue: venue || null },
      }),
    );
  }

  await db.$transaction(updates);
  await audit(session.userId, "MATCH_SCHEDULE", "Match", ids[0], { matches: updates.length });
  refreshAll();
  return { ok: `บันทึกวันเวลาแข่ง ${updates.length} คู่แล้ว` };
}
