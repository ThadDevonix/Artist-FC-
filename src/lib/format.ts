const TZ = "Asia/Bangkok";

/** 27 ต.ค. 2569 */
export function thaiDate(date: Date | string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/** จันทร์ 27 ต.ค. */
export function thaiDayMonth(date: Date | string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

/** 19:30 */
export function thaiTime(date: Date | string) {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));
}

/** 27 ต.ค. 2569 19:30 */
export function thaiDateTime(date: Date | string) {
  return `${thaiDate(date)} ${thaiTime(date)}`;
}

/** ค่าสำหรับ <input type="datetime-local"> ตามเวลาไทย */
export function toDateTimeLocal(date: Date | string) {
  const d = new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * แปลงค่าจาก <input type="datetime-local"> หรือ วันที่ + เวลา เป็น Date ตามเวลาไทยเสมอ
 *
 * ทำไมต้องมี: new Date("2026-11-13T15:00") ตีความตามเขตเวลาของเครื่องเซิร์ฟเวอร์
 * บน Vercel เป็น UTC → 15:00 กลายเป็น 22:00 น. เวลาไทย (บนเครื่องที่ตั้งเวลาไทยจะดูปกติ จึงหลุดง่าย)
 * ไทยไม่มีเวลาออมแสง จึงต่อท้าย +07:00 ได้ตรง ๆ
 */
export function fromThaiDateTime(date: string, time = "00:00"): Date {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+07:00`);
}

/** วันที่ (YYYY-MM-DD) ตามเวลาไทย — ใช้เติมค่าใน <input type="date"> */
export function toThaiDate(date: Date | string) {
  return toDateTimeLocal(date).slice(0, 10);
}

/** เวลา (HH:mm) ตามเวลาไทย — ใช้เติมค่าใน <input type="time"> */
export function toThaiTime(date: Date | string) {
  return toDateTimeLocal(date).slice(11, 16);
}

/** เลื่อนวันที่ YYYY-MM-DD ไป n วัน (ไม่ขึ้นกับเขตเวลา) */
export function addDaysYmd(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** +7 / -3 / 0 */
export function signed(n: number) {
  return n > 0 ? `+${n}` : String(n);
}

/** 90+3' */
export function minuteLabel(minute: number, extra?: number | null) {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

/** ตัวย่อทีมเวลาไม่มีโลโก้ */
export function initials(name: string) {
  return name.trim().slice(0, 2);
}

/** อายุเป็นปีจากวันเกิด — แยกออกจาก component เพราะอ่านเวลาปัจจุบัน */
export function ageFrom(birthDate: Date | string | null | undefined): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age--;
  return age;
}

/**
 * ถอดรหัส path param — Next.js ส่งค่ามาแบบยัง percent-encoded
 * จำเป็นสำหรับ slug ภาษาไทย เช่น /players/LTU-พีรพล-สมบูรณ์-1
 */
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value; // URL ที่เข้ารหัสผิดรูป ใช้ค่าเดิมไปก่อน แล้วจะกลายเป็น 404 ตามปกติ
  }
}
