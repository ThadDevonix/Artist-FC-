/**
 * อ่านรายชื่อนักเตะที่วางมาจาก Excel / Google Sheets หรือไฟล์ CSV
 *
 * ใช้ทั้งฝั่งเบราว์เซอร์ (แสดงตัวอย่างก่อนกดยืนยัน) และฝั่งเซิร์ฟเวอร์ (ตรวจซ้ำก่อนบันทึกจริง)
 * จึงต้องไม่พึ่ง DB หรือ React
 *
 * คอลัมน์ตามลำดับ: ชื่อ | เบอร์ | ตำแหน่ง | สัญชาติ | วันเกิด — ต้องมีแค่ชื่อ ที่เหลือเว้นว่างได้
 * ไม่ต้องมีคอลัมน์ทีม เพราะนำเข้าจากในหน้าของทีมนั้นอยู่แล้ว
 */

import { POSITION_LABEL } from "@/lib/labels";
import type { Position } from "@/generated/prisma/enums";

export const ROSTER_COLUMNS = ["ชื่อ", "เบอร์", "ตำแหน่ง", "สัญชาติ", "วันเกิด"] as const;
export const ROSTER_MAX_ROWS = 300;

export type RosterRow = {
  line: number; // เลขบรรทัดในไฟล์ ใช้บอกผู้ใช้ว่าผิดตรงไหน
  name: string;
  number: number | null;
  position: Position;
  nationality: string | null;
  birthDate: string | null; // YYYY-MM-DD
  errors: string[];
};

/** รับได้ทั้งรหัส (FW) ชื่อไทย (กองหน้า) และคำที่คนมักพิมพ์ */
const POSITION_ALIASES: Record<string, Position> = {
  gk: "GK", goalkeeper: "GK", โกล: "GK", ผู้รักษาประตู: "GK",
  df: "DF", defender: "DF", กองหลัง: "DF", แบ็ค: "DF", แบ็ก: "DF",
  mf: "MF", midfielder: "MF", กองกลาง: "MF",
  fw: "FW", forward: "FW", กองหน้า: "FW", ศูนย์หน้า: "FW",
};
for (const [code, label] of Object.entries(POSITION_LABEL)) {
  POSITION_ALIASES[label] = code as Position;
}

const DATE_PATTERN = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})$/;

/**
 * พิมพ์เองคั่นด้วยเว้นวรรค เช่น "สมศักดิ์ ใจดี 10 FW ไทย 1998-05-12"
 * ชื่อมีเว้นวรรคได้ จึงดูจากชนิดคำแทน: ชื่อ = คำก่อนเบอร์/ตำแหน่ง ส่วนคำหลังจากนั้นจัดเข้าช่องตามหน้าตา
 */
function splitBySpaces(line: string): string[] {
  const words = line.trim().split(/\s+/);
  const isNumber = (w: string) => /^\d{1,3}$/.test(w);
  const isPosition = (w: string) => w.toLowerCase() in POSITION_ALIASES;

  let end = words.findIndex((w, i) => i > 0 && (isNumber(w) || isPosition(w) || DATE_PATTERN.test(w)));
  if (end === -1) end = words.length;

  const cells = [words.slice(0, end).join(" "), "", "", "", ""];
  const rest: string[] = [];
  for (const w of words.slice(end)) {
    if (!cells[1] && isNumber(w)) cells[1] = w;
    else if (!cells[2] && isPosition(w)) cells[2] = w;
    else if (!cells[4] && DATE_PATTERN.test(w)) cells[4] = w;
    else rest.push(w);
  }
  cells[3] = rest.join(" "); // คำที่เหลือถือเป็นสัญชาติ
  return cells;
}

/** แยกคอลัมน์หนึ่งบรรทัด — วางจาก Excel จะคั่นด้วย tab, ไฟล์ CSV คั่นด้วย , และอาจมี "..." ครอบ, พิมพ์เองคั่นด้วยเว้นวรรค */
function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (!line.includes(",")) return splitBySpaces(line);

  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { cells.push(cell.trim()); cell = ""; }
    else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

/** รับ 1998-05-12, 12/05/1998 และปี พ.ศ. 12/05/2541 */
function parseDate(text: string): string | null | undefined {
  if (!text) return null;
  let y: number, m: number, d: number;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (dmy) [d, m, y] = [+dmy[1], +dmy[2], +dmy[3]];
  else return undefined;

  if (y > 2400) y -= 543; // พ.ศ. → ค.ศ.
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return undefined;
  return date.toISOString().slice(0, 10);
}

/** บรรทัดแรกเป็นหัวตารางหรือเปล่า (เช่น "ชื่อ, เบอร์, ...") */
function isHeader(cells: string[]) {
  const first = cells[0]?.toLowerCase() ?? "";
  return /^(ชื่อ|ชื่อ-สกุล|name)(\s|$)/.test(first);
}

export function parseRoster(text: string): RosterRow[] {
  const rows: RosterRow[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);

  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const cells = splitLine(raw);
    if (i === 0 && isHeader(cells)) return;

    const [name = "", numberText = "", positionText = "", nationality = "", dateText = ""] = cells;
    const errors: string[] = [];

    if (!name) errors.push("ไม่มีชื่อ");

    let number: number | null = null;
    if (numberText) {
      number = Number(numberText);
      if (!Number.isInteger(number) || number < 1 || number > 99) {
        errors.push("เบอร์ต้องเป็น 1–99");
        number = null;
      }
    }

    let position: Position = "MF";
    if (positionText) {
      const found = POSITION_ALIASES[positionText.toLowerCase()];
      if (found) position = found;
      else errors.push(`ไม่รู้จักตำแหน่ง "${positionText}"`);
    }

    const birthDate = parseDate(dateText);
    if (birthDate === undefined) errors.push(`วันเกิด "${dateText}" ไม่ถูกต้อง`);

    rows.push({
      line: i + 1,
      name,
      number,
      position,
      nationality: nationality || null,
      birthDate: birthDate ?? null,
      errors,
    });
  });

  return rows;
}

/**
 * ตรวจเบอร์เสื้อซ้ำ — ทั้งซ้ำกันเองในไฟล์ และซ้ำกับนักเตะที่อยู่ในทีมแล้ว
 * แก้ errors ของแต่ละแถวในที่ (in place) แล้วคืนแถวเดิมกลับไป
 */
export function markDuplicateNumbers(rows: RosterRow[], takenNumbers: Iterable<number>) {
  const taken = new Set(takenNumbers);
  const seen = new Map<number, number>();
  for (const row of rows) {
    if (row.number === null) continue;
    if (taken.has(row.number)) row.errors.push(`เบอร์ ${row.number} มีคนในทีมใช้อยู่แล้ว`);
    else if (seen.has(row.number)) row.errors.push(`เบอร์ ${row.number} ซ้ำกับบรรทัด ${seen.get(row.number)}`);
    else seen.set(row.number, row.line);
  }
  return rows;
}

/** ไฟล์ตัวอย่างให้ดาวน์โหลด — ใส่ BOM เพื่อให้ Excel เปิดภาษาไทยได้ถูก */
export function rosterTemplateCsv() {
  return (
    "﻿" +
    [ROSTER_COLUMNS.join(","), "สมศักดิ์ ใจดี,10,FW,ไทย,1998-05-12", "วิชัย มือหนึ่ง,1,GK,ไทย,12/05/2541"].join("\r\n")
  );
}
