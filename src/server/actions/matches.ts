"use server";

import { db } from "@/server/db";
import { audit, requireRole, requireSession } from "@/server/auth";
import { loadEditableMatch } from "@/server/guards";
import {
  matchDetailSchema,
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

  const isAdmin = session.role === "ADMIN";
  const now = new Date();

  await db.match.update({
    where: { id: matchId },
    data: {
      homeGoals,
      awayGoals,
      notes,
      status: isAdmin ? "FINISHED" : "PENDING",
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

/** แก้วันเวลา สนาม ผู้ตัดสิน และสถานะ — เฉพาะผู้ดูแลระบบ */
export async function updateMatchAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const parsed = parseForm(matchDetailSchema, formData);
  if (!parsed.ok) return;
  const { matchId, kickoffAt, venue, refereeId, status } = parsed.data;

  await db.match.update({
    where: { id: matchId },
    data: {
      ...(kickoffAt ? { kickoffAt } : {}),
      venue,
      refereeId,
      ...(status ? { status } : {}),
    },
  });
  await audit(session.userId, "MATCH_UPDATE", "Match", matchId);
  refreshAll();
}
