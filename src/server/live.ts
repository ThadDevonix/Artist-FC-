import "server-only";
import { db } from "@/server/db";
import type { EventType } from "@/generated/prisma/enums";

/**
 * สกอร์สดระหว่างถ่ายทอด — นับจากเหตุการณ์ประตู แอดมินไม่ต้องกรอกสกอร์เอง
 * ทุกชนิดนับให้ "ทีมที่ได้ประโยชน์" (teamId ของเหตุการณ์) รวมถึงทำเข้าประตูตัวเอง
 */
const SCORE_EVENTS: EventType[] = ["GOAL", "PENALTY_GOAL", "OWN_GOAL"];

export async function scoreFromEvents(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      status: true,
      homeTeamId: true,
      awayTeamId: true,
      events: { where: { type: { in: SCORE_EVENTS } }, select: { teamId: true } },
    },
  });
  if (!match) return null;
  return {
    status: match.status,
    homeGoals: match.events.filter((e) => e.teamId === match.homeTeamId).length,
    awayGoals: match.events.filter((e) => e.teamId === match.awayTeamId).length,
  };
}

/**
 * อัปเดตสกอร์ของนัดที่กำลังแข่งให้ตรงกับเหตุการณ์ — เรียกทุกครั้งที่เพิ่ม/ลบเหตุการณ์หรือเริ่มถ่ายทอด
 * นัดที่ไม่ได้ LIVE ไม่แตะ (สกอร์ของนัดที่จบแล้วมาจากการบันทึกผล/อนุมัติเท่านั้น)
 * สกอร์ที่เก็บไว้บนนัดทำให้ทุกหน้าที่แสดงสกอร์อยู่แล้วเห็นสกอร์สดทันที ส่วนตารางคะแนนทางการนับเฉพาะ FINISHED จึงไม่กระทบ
 */
export async function syncLiveScore(matchId: string) {
  const score = await scoreFromEvents(matchId);
  if (!score || score.status !== "LIVE") return;
  await db.match.update({
    where: { id: matchId },
    data: { homeGoals: score.homeGoals, awayGoals: score.awayGoals },
  });
}
