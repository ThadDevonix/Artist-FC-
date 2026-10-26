"use server";

import { db } from "@/server/db";
import { audit, requireSession } from "@/server/auth";
import { loadEditableMatch, matchPermission } from "@/server/guards";
import { eventIdSchema, eventSchema, parseForm, type ActionState } from "@/server/validation";
import { refreshAll } from "./shared";

export async function addEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const parsed = parseForm(eventSchema, formData);
  if (!parsed.ok) return { error: parsed.error };
  const { matchId, ...event } = parsed.data;

  const access = await loadEditableMatch(session, matchId);
  if (!access.ok) return { error: access.error };

  // ทีมที่ระบุต้องเป็นหนึ่งในสองทีมที่ลงแข่งจริง
  const { match } = access;
  if (event.teamId !== match.homeTeamId && event.teamId !== match.awayTeamId) {
    return { error: "ทีมที่เลือกไม่ได้ลงแข่งในนัดนี้" };
  }

  await db.matchEvent.create({ data: { matchId, ...event } });
  await audit(session.userId, "EVENT_ADD", "Match", matchId, {
    type: event.type,
    minute: event.minute,
  });

  refreshAll();
  return { ok: "เพิ่มเหตุการณ์แล้ว" };
}

export async function deleteEventAction(formData: FormData) {
  const session = await requireSession();
  const parsed = parseForm(eventIdSchema, formData);
  if (!parsed.ok) return;

  const event = await db.matchEvent.findUnique({
    where: { id: parsed.data.eventId },
    include: { match: { select: { id: true, refereeId: true, status: true } } },
  });
  if (!event) return;

  if (!matchPermission(session, event.match).canEdit) return;

  await db.matchEvent.delete({ where: { id: event.id } });
  await audit(session.userId, "EVENT_DELETE", "Match", event.match.id, { eventId: event.id });
  refreshAll();
}
