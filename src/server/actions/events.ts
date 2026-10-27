"use server";

import { db } from "@/server/db";
import { audit, requireSession } from "@/server/auth";
import { loadEditableMatch, matchPermission, matchOfficialsInclude } from "@/server/guards";
import { eventIdSchema, eventSchema, parseForm, type ActionState } from "@/server/validation";
import { CARD_EVENTS } from "@/lib/labels";
import { syncLiveScore } from "@/server/live";
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

  // ผู้ให้ใบ: เฉพาะใบเหลือง/แดง และต้องเป็นคนในทีมผู้ตัดสินของนัดนี้ ไม่เลือก = ผู้ตัดสินที่ 1
  let issuedById: string | null = null;
  if (CARD_EVENTS.includes(event.type)) {
    const crew = [match.refereeId, match.assistant1Id, match.assistant2Id, match.fourthOfficialId].filter(Boolean);
    if (event.issuedById && !crew.includes(event.issuedById)) {
      return { error: "ผู้ให้ใบต้องอยู่ในทีมผู้ตัดสินของนัดนี้" };
    }
    issuedById = event.issuedById ?? match.refereeId;
  }

  await db.matchEvent.create({ data: { matchId, ...event, issuedById } });
  await syncLiveScore(matchId);
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
    include: { match: { select: { id: true, status: true, ...matchOfficialsInclude } } },
  });
  if (!event) return;

  if (!matchPermission(session, event.match).canEdit) return;

  await db.matchEvent.delete({ where: { id: event.id } });
  await syncLiveScore(event.match.id);
  await audit(session.userId, "EVENT_DELETE", "Match", event.match.id, { eventId: event.id });
  refreshAll();
}
