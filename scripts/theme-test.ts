/** ทดสอบว่าธีมสลับตามเวลาไทยถูกต้องทุกชั่วโมง ไม่ว่าเครื่องจะอยู่ timezone ไหน */
import {
  DAY_START,
  NIGHT_START,
  resolveTheme,
  thaiHour,
  themeByThaiTime,
  themeLabel,
} from "../src/lib/theme";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

/** สร้าง Date ที่ตรงกับเวลาไทยตามชั่วโมงที่ต้องการ */
const atThaiHour = (hour: number) =>
  new Date(`2026-10-27T${String(hour).padStart(2, "0")}:30:00+07:00`);

console.log(`\nเวลาไทยตอนนี้: ${thaiHour()} น. → ธีม ${themeByThaiTime()}\n`);
console.log(`กลางวัน ${DAY_START}:00–${NIGHT_START - 1}:59 น. · กลางคืน ${NIGHT_START}:00–${DAY_START - 1}:59 น.\n`);

const rows: string[] = [];
for (let h = 0; h < 24; h++) {
  const theme = themeByThaiTime(atThaiHour(h));
  const expected = h >= DAY_START && h < NIGHT_START ? "light" : "dark";
  if (theme !== expected) failures++;
  rows.push(`${String(h).padStart(2, "0")}:30 → ${theme === "light" ? "ขาว" : "ดำ"}`);
}
for (let i = 0; i < rows.length; i += 4) console.log("  " + rows.slice(i, i + 4).join("   "));

console.log();
check("ครบทั้ง 24 ชั่วโมงถูกต้อง", failures === 0);
check("06:00 น. เปลี่ยนเป็นขาว", themeByThaiTime(atThaiHour(6)) === "light");
check("05:00 น. ยังเป็นดำ", themeByThaiTime(atThaiHour(5)) === "dark");
check("17:00 น. ยังเป็นขาว", themeByThaiTime(atThaiHour(17)) === "light");
check("18:00 น. เปลี่ยนเป็นดำ", themeByThaiTime(atThaiHour(18)) === "dark");

// ค่าที่ผู้ใช้ตั้งเองต้องชนะเวลาเสมอ
check("ตั้งค่าเอง 'สว่าง' ตอนกลางคืน ยังได้สว่าง", resolveTheme("light", atThaiHour(23)) === "light");
check("ตั้งค่าเอง 'มืด' ตอนกลางวัน ยังได้มืด", resolveTheme("dark", atThaiHour(12)) === "dark");
check("ตั้งเป็น 'ตามเวลาไทย' ใช้เวลาเป็นตัวตัดสิน", resolveTheme("auto", atThaiHour(12)) === "light");

// ต้องอ่านเวลาไทยได้ถูกไม่ว่าเครื่องตั้ง timezone ไว้ยังไง
const utcNoon = new Date("2026-10-27T12:00:00Z"); // = 19:00 น. ไทย
check("แปลง UTC เป็นเวลาไทยถูกต้อง", thaiHour(utcNoon) === 19, `ได้ ${thaiHour(utcNoon)} น.`);
check("UTC เที่ยงวัน = กลางคืนที่ไทย → ธีมดำ", themeByThaiTime(utcNoon) === "dark");

check("ข้อความอธิบายตรงกับสถานะ", themeLabel("auto", atThaiHour(12)).includes("กลางวัน"));

console.log(failures === 0 ? "\nผ่านทั้งหมด ✓" : `\nไม่ผ่าน ${failures} รายการ ✗`);
process.exit(failures === 0 ? 0 : 1);
