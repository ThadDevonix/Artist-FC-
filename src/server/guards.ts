/**
 * กฎว่าใครแก้อะไรได้ — รวมไว้ที่เดียว
 *
 * ทำไมต้องแยกออกมา: เดิมเงื่อนไข "กรรมการแก้ได้เฉพาะนัดของตัวเอง และแก้ไม่ได้ถ้าอนุมัติแล้ว"
 * ถูกเขียนซ้ำใน 3 action (บันทึกผล / เพิ่มเหตุการณ์ / ลบเหตุการณ์)
 * ถ้าวันหนึ่งกฎเปลี่ยน ต้องไล่แก้ทุกที่และมีโอกาสตกหล่นจนเกิดช่องโหว่
 *
 * ตอนนี้แก้ที่เดียวแล้วมีผลทั้งระบบ และหน้าเพจก็เรียกฟังก์ชันเดียวกันนี้
 * ตัดสินใจว่าจะโชว์ปุ่มไหม ทำให้สิ่งที่เห็นบนจอตรงกับสิ่งที่เซิร์ฟเวอร์ยอมจริง
 */

import "server-only";
import { db } from "@/server/db";
import type { Session } from "@/server/auth";
import type { MatchStatus } from "@/generated/prisma/enums";

export type MatchPermission = {
  /** กรอกสกอร์และเพิ่ม/ลบเหตุการณ์ได้ไหม */
  canEdit: boolean;
  /** อนุมัติหรือตีกลับผลได้ไหม */
  canApprove: boolean;
  /** แก้วันเวลา สนาม ผู้ตัดสิน สถานะได้ไหม */
  canManage: boolean;
  /** เหตุผลที่แก้ไม่ได้ ใช้แสดงบนหน้าจอ */
  reason: string | null;
};

type MatchLike = {
  refereeId: string | null;
  status: MatchStatus;
};

export const NOT_YOUR_MATCH = "คุณไม่ได้เป็นผู้ตัดสินของนัดนี้";
export const ALREADY_APPROVED = "นัดนี้อนุมัติแล้ว แก้ไขได้เฉพาะผู้ดูแลระบบ";

/**
 * สิทธิ์ของผู้ใช้คนนี้ต่อนัดนี้
 *
 * ผู้ดูแลระบบ — ทำได้ทุกอย่าง
 * กรรมการ     — เฉพาะนัดที่ตัวเองเป็นผู้ตัดสิน และเฉพาะตอนที่ยังไม่อนุมัติ
 */
export function matchPermission(session: Session, match: MatchLike): MatchPermission {
  if (session.role === "ADMIN") {
    return { canEdit: true, canApprove: true, canManage: true, reason: null };
  }

  if (match.refereeId !== session.userId) {
    return { canEdit: false, canApprove: false, canManage: false, reason: NOT_YOUR_MATCH };
  }

  if (match.status === "FINISHED") {
    return { canEdit: false, canApprove: false, canManage: false, reason: ALREADY_APPROVED };
  }

  return { canEdit: true, canApprove: false, canManage: false, reason: null };
}

/**
 * ดึงนัดพร้อมเช็กสิทธิ์ในครั้งเดียว — ใช้ใน action ที่จะแก้ข้อมูล
 * คืน error เป็นข้อความไทยพร้อมแสดงบนฟอร์ม ไม่ throw เพื่อให้ฟอร์มยังอยู่ครบ
 */
export async function loadEditableMatch(session: Session, matchId: string) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) return { ok: false as const, error: "ไม่พบนัดนี้" };

  const permission = matchPermission(session, match);
  if (!permission.canEdit) {
    return { ok: false as const, error: permission.reason ?? "คุณไม่มีสิทธิ์แก้ไขนัดนี้" };
  }

  return { ok: true as const, match, permission };
}

/**
 * ลบทีมหรือเอาทีมออกจากฤดูกาลได้ก็ต่อเมื่อยังไม่มีผลแข่งที่นับคะแนนไปแล้ว
 * ไม่งั้นตารางคะแนนย้อนหลังจะเพี้ยน
 */
export async function teamHasResults(teamId: string, seasonId?: string) {
  const played = await db.match.count({
    where: {
      ...(seasonId ? { seasonId } : {}),
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      status: "FINISHED",
    },
  });
  return played > 0;
}

/** ต้องเหลือผู้ดูแลระบบอย่างน้อย 1 คนเสมอ ไม่งั้นจะไม่มีใครเข้าระบบได้อีก */
export async function isLastAdmin(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user?.role !== "ADMIN") return false;
  const admins = await db.user.count({ where: { role: "ADMIN", active: true } });
  return admins <= 1;
}
