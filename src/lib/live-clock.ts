/**
 * นาฬิกาถ่ายทอดสด — คำนวณนาทีจากช่วงเวลาปัจจุบันและเวลาที่ช่วงนั้นเริ่ม
 * ไม่พึ่ง DB/React ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
 *
 * นับแบบฟุตบอล: นาทีแรกคือ 1' · เกินเวลาช่วงแสดงเป็นทดเวลา เช่น 45+2', 90+3'
 * จำนวนช่วงและนาทีต่อช่วงมาจากการตั้งค่าฤดูกาล (2 ครึ่ง × 45 นาที, 4 ควอเตอร์ × 12 นาที ฯลฯ)
 */
export type LiveClockInput = {
  /** ช่วงที่กำลังแข่ง 1…periods (null = ไม่ได้ถ่ายทอดสด) */
  period: number | null;
  /** พักหลังจบช่วง period */
  onBreak: boolean;
  startedAt: Date | string | null;
  periods: number;
  periodMinutes: number;
  /** ต่อเวลาช่วงละกี่นาที — ช่วงที่ periods+1, periods+2 คือต่อเวลา (มีเฉพาะนัดน็อคเอาต์ที่เสมอ) */
  extraMinutes: number;
};

export type LiveClockReading = {
  label: string;
  /** นาทีหลัก กับนาทีทดเจ็บ — ใช้เติมช่องนาทีตอนบันทึกเหตุการณ์ (ช่วงพัก = null) */
  minute: number | null;
  extra: number | null;
};

/** จำนวนช่วงที่เลือกได้ในหน้าตั้งค่าฤดูกาล */
export const PERIOD_OPTIONS = [
  { value: 1, label: "ช่วงเดียว (ไม่มีพัก)" },
  { value: 2, label: "2 ครึ่ง" },
  { value: 3, label: "3 ช่วง" },
  { value: 4, label: "4 ควอเตอร์" },
] as const;

/** ชื่อช่วง เช่น "ครึ่งแรก", "ควอเตอร์ที่ 3", "ช่วงที่ 2", "ต่อเวลาครึ่งแรก" */
export function periodName(period: number, periods: number) {
  if (period > periods) return period === periods + 1 ? "ต่อเวลาครึ่งแรก" : "ต่อเวลาครึ่งหลัง";
  if (periods === 2) return period === 1 ? "ครึ่งแรก" : "ครึ่งหลัง";
  if (periods === 4) return `ควอเตอร์ที่ ${period}`;
  if (periods === 1) return "เกม";
  return `ช่วงที่ ${period}`;
}

/** ข้อความช่วงพัก เช่น "พักครึ่ง", "พักหลังควอเตอร์ที่ 1", "พักก่อนต่อเวลา" */
export function breakName(period: number, periods: number) {
  if (period === periods) return "พักก่อนต่อเวลา";
  if (period > periods) return "พักครึ่งต่อเวลา";
  return periods === 2 ? "พักครึ่ง" : `พักหลัง${periodName(period, periods)}`;
}

/** นาทีที่ช่วงนี้เริ่ม และความยาวช่วง — ช่วงต่อเวลานับต่อจากเวลาปกติทั้งหมด (90 → 91' … 105', 106' … 120') */
function periodSpan(period: number, periods: number, periodMinutes: number, extraMinutes: number) {
  if (period <= periods) return { offset: (period - 1) * periodMinutes, length: periodMinutes };
  return { offset: periods * periodMinutes + (period - periods - 1) * extraMinutes, length: extraMinutes };
}

export function readClock({ period, onBreak, startedAt, periods, periodMinutes, extraMinutes }: LiveClockInput, nowMs: number): LiveClockReading {
  if (!period || !startedAt) return { label: "", minute: null, extra: null };
  if (onBreak) return { label: breakName(period, periods), minute: null, extra: null };

  const played = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 60_000)) + 1;
  const { offset, length } = periodSpan(period, periods, periodMinutes, extraMinutes);
  const end = offset + length;
  const minute = offset + played;

  if (minute > end) {
    const extra = Math.min(minute - end, 20);
    return { label: `${end}+${extra}'`, minute: end, extra };
  }
  return { label: `${minute}'`, minute, extra: null };
}

/**
 * เวลาเกมแบบนาฬิกาจับเวลา "MM:SS" — ช่วงถัดไปนับต่อจากความยาวช่วงก่อน ๆ (เช่น 45:00 → 45:01 …)
 * ไม่ตัดที่ทดเวลา (เช่น 47:12) เพื่อให้คนลงข้อมูลเห็นเวลาที่เดินจริง · ช่วงพัก/ไม่ได้แข่ง = null
 */
export function readStopwatch({ period, onBreak, startedAt, periods, periodMinutes, extraMinutes }: LiveClockInput, nowMs: number): string | null {
  if (!startedAt || !period || onBreak) return null;
  const elapsed = Math.max(0, Math.floor((nowMs - new Date(startedAt).getTime()) / 1000));
  const total = elapsed + periodSpan(period, periods, periodMinutes, extraMinutes).offset * 60;
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * props สำหรับ <LiveClock> จากข้อมูลนัด — เรียกจาก server component ตอน render
 * serverNow คือเวลาเซิร์ฟเวอร์ ณ ตอนนั้น ใช้ชดเชยนาฬิกาเครื่องคนดูที่เพี้ยน
 */
export function liveClockProps(match: {
  livePeriod: number | null;
  liveBreak: boolean;
  phaseStartedAt: Date | null;
  season: { periods: number; periodMinutes: number; extraTimeMinutes: number };
}) {
  return {
    period: match.livePeriod,
    onBreak: match.liveBreak,
    startedAt: match.phaseStartedAt?.toISOString() ?? null,
    periods: match.season.periods,
    periodMinutes: match.season.periodMinutes,
    extraMinutes: match.season.extraTimeMinutes,
    serverNow: Date.now(),
  };
}
