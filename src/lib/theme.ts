/**
 * ธีมขาว/ดำสลับตามเวลาประเทศไทย
 *
 * กลางวัน (06:00–17:59 น.) → ขาว
 * กลางคืน (18:00–05:59 น.) → ดำ
 *
 * ฝั่งเซิร์ฟเวอร์คำนวณให้ตั้งแต่แรก หน้าเว็บจึงไม่กะพริบตอนโหลด
 * ส่วนฝั่งเบราว์เซอร์คอยเช็กทุกนาทีเผื่อข้ามเวลาพอดีระหว่างเปิดหน้าค้างไว้
 */

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "auto";

export const DAY_START = 6; // 06:00 น.
export const NIGHT_START = 18; // 18:00 น.

export const THEME_COOKIE = "artistfc_theme";
export const THEME_STORAGE_KEY = "artistfc-theme";

/** ชั่วโมงปัจจุบันตามเวลาไทย ไม่ขึ้นกับ timezone ของเครื่อง */
export function thaiHour(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "numeric",
      hour12: false,
    }).format(date),
  ) % 24;
}

export function themeByThaiTime(date: Date = new Date()): Theme {
  const hour = thaiHour(date);
  return hour >= DAY_START && hour < NIGHT_START ? "light" : "dark";
}

/** ธีมที่จะใช้จริง หลังคิดค่าที่ผู้ใช้เลือกไว้เอง */
export function resolveTheme(preference: ThemePreference, date: Date = new Date()): Theme {
  return preference === "auto" ? themeByThaiTime(date) : preference;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "auto" || value === "light" || value === "dark";
}

/** ข้อความอธิบายว่าตอนนี้ธีมมาจากไหน ใช้บอกผู้ใช้ตรงปุ่มสลับ */
export function themeLabel(preference: ThemePreference, date: Date = new Date()): string {
  if (preference === "light") return "โหมดสว่าง (ตั้งค่าเอง)";
  if (preference === "dark") return "โหมดมืด (ตั้งค่าเอง)";
  return themeByThaiTime(date) === "light"
    ? "ตามเวลาไทย · ตอนนี้กลางวัน"
    : "ตามเวลาไทย · ตอนนี้กลางคืน";
}
