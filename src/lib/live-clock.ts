/**
 * นาฬิกาถ่ายทอดสด — คำนวณนาทีจากช่วงเวลาปัจจุบันและเวลาที่ช่วงนั้นเริ่ม
 * ไม่พึ่ง DB/React ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
 *
 * นับแบบฟุตบอล: นาทีแรกคือ 1' · เกินเวลาครึ่งแสดงเป็นทดเวลา เช่น 45+2', 90+3'
 */
import type { LivePhase } from "@/generated/prisma/enums";

export type LiveClockInput = {
  phase: LivePhase | null;
  startedAt: Date | string | null;
  halfMinutes: number;
};

export type LiveClockReading = {
  label: string;
  /** นาทีหลัก กับนาทีทดเจ็บ — ใช้เติมช่องนาทีตอนบันทึกเหตุการณ์ (พักครึ่ง = null) */
  minute: number | null;
  extra: number | null;
};

export function readClock({ phase, startedAt, halfMinutes }: LiveClockInput, nowMs: number): LiveClockReading {
  if (phase === "HALF_TIME") return { label: "พักครึ่ง", minute: null, extra: null };
  if (!phase || !startedAt) return { label: "", minute: null, extra: null };

  const played = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 60_000)) + 1;
  const offset = phase === "SECOND_HALF" ? halfMinutes : 0;
  const end = offset + halfMinutes;
  const minute = offset + played;

  if (minute > end) {
    const extra = Math.min(minute - end, 20);
    return { label: `${end}+${extra}'`, minute: end, extra };
  }
  return { label: `${minute}'`, minute, extra: null };
}

/**
 * เวลาเกมแบบนาฬิกาจับเวลา "MM:SS" — ครึ่งหลังนับต่อจากความยาวครึ่งแรก (45:00 → 45:01 …)
 * ไม่ตัดที่ทดเวลา (เช่น 47:12) เพื่อให้คนลงข้อมูลเห็นเวลาที่เดินจริง · พักครึ่ง/ไม่ได้แข่ง = null
 */
export function readStopwatch({ phase, startedAt, halfMinutes }: LiveClockInput, nowMs: number): string | null {
  if (!startedAt || (phase !== "FIRST_HALF" && phase !== "SECOND_HALF")) return null;
  const elapsed = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));
  const total = elapsed + (phase === "SECOND_HALF" ? halfMinutes * 60 : 0);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * props สำหรับ <LiveClock> จากข้อมูลนัด — เรียกจาก server component ตอน render
 * serverNow คือเวลาเซิร์ฟเวอร์ ณ ตอนนั้น ใช้ชดเชยนาฬิกาเครื่องคนดูที่เพี้ยน
 */
export function liveClockProps(match: {
  livePhase: LivePhase | null;
  phaseStartedAt: Date | null;
  season: { halfMinutes: number };
}) {
  return {
    phase: match.livePhase,
    startedAt: match.phaseStartedAt?.toISOString() ?? null,
    halfMinutes: match.season.halfMinutes,
    serverNow: Date.now(),
  };
}
