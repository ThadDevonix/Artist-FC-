/**
 * ตรวจความถูกต้องของข้อมูลที่ส่งมาจากฟอร์ม — รวมไว้ที่เดียว
 *
 * ทำไมต้องมีชั้นนี้: ข้อมูลจากฟอร์มเป็น string เสมอ และผู้ใช้แก้ HTML ส่งอะไรมาก็ได้
 * ถ้าปล่อยให้แต่ละ action ตรวจเอง จะได้ข้อความ error คนละแบบ และมักจะลืมตรวจบางช่อง
 * จนต้อง cast เป็น `as never` เพื่อให้ TypeScript ผ่าน ซึ่งเท่ากับปิดตาตัวเอง
 *
 * ที่นี่ใช้ zod ตรวจแล้วคืน type ที่ตรงกับ Prisma enum จริง ๆ ไม่ต้อง cast เลย
 */

import { z } from "zod";
import { EVENT_TYPES, POSITIONS } from "@/lib/labels";
import type { EventType, MatchStatus, Position, Role } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: string };

// ───────────────────────────── ตัวช่วยอ่านค่าจากฟอร์ม ─────────────────────────────

/** ข้อความที่ต้องกรอก */
const required = (message: string) => z.string().trim().min(1, message);

/**
 * ข้อความที่เว้นว่างได้ — เว้นว่างแล้วเก็บเป็น null ไม่ใช่ ""
 *
 * ต้องรองรับกรณีที่ฟอร์ม "ไม่ส่ง field นั้นมาเลย" ด้วย ไม่ใช่แค่ส่งมาเป็นค่าว่าง
 * เพราะ checkbox ที่ไม่ติ๊ก หรือช่องที่ถูกซ่อนตามเงื่อนไข จะไม่ถูกส่งมาใน FormData
 */
const optionalText = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim() || null);

/** ตัวเลขที่เว้นว่างได้ */
const optionalInt = z
  .string()
  .optional()
  .transform((v) => {
    const text = (v ?? "").trim();
    return text === "" ? null : Number(text);
  })
  .refine((v) => v === null || Number.isInteger(v), "ต้องเป็นจำนวนเต็ม");

/** ตัวเลขที่ต้องกรอก พร้อมขอบเขต */
const requiredInt = (min: number, max: number, message: string) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const text = (v ?? "").trim();
      return text === "" ? NaN : Number(text);
    })
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, message);

/** ตัวเลขที่เว้นว่างได้ แล้วใช้ค่าตั้งต้นแทน */
const intWithDefault = (fallback: number, min: number, max: number, message: string) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const text = (v ?? "").trim();
      return text === "" ? fallback : Number(text);
    })
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, message);

/** วันที่จากช่อง date / datetime-local */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    const text = (v ?? "").trim();
    return text ? new Date(text) : null;
  })
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "รูปแบบวันที่ไม่ถูกต้อง");

/** checkbox: มีค่าส่งมา = ติ๊ก */
const checkbox = z
  .string()
  .nullish()
  .transform((v) => v !== null && v !== undefined);

/** แปลง FormData เป็น object ให้ zod ตรวจได้ (ช่องที่ไม่มีจะได้ "") */
function toObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * ตรวจฟอร์มด้วย schema แล้วคืนผลแบบที่ action เอาไปใช้ต่อได้ทันที
 * ถ้าไม่ผ่าน จะได้ข้อความ error ภาษาไทยข้อแรกกลับไปแสดงบนฟอร์ม
 */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; error: string } {
  const result = schema.safeParse(toObject(formData));
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
}

// ───────────────────────────── enum ที่ตรงกับฐานข้อมูล ─────────────────────────────

export const matchStatusEnum = z.enum([
  "SCHEDULED", "LIVE", "PENDING", "FINISHED", "POSTPONED", "CANCELLED",
]) satisfies z.ZodType<MatchStatus>;

export const eventTypeEnum = z.enum(
  EVENT_TYPES as [EventType, ...EventType[]],
) satisfies z.ZodType<EventType>;

export const positionEnum = z.enum(
  POSITIONS as [Position, ...Position[]],
) satisfies z.ZodType<Position>;

export const roleEnum = z.enum(["ADMIN", "REFEREE"]) satisfies z.ZodType<Role>;

/** อ่านค่าจาก query string ให้ปลอดภัย — ค่าที่ไม่รู้จักจะได้ undefined */
export function parseEnumParam<T extends string>(
  schema: z.ZodType<T>,
  value: unknown,
): T | undefined {
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

// ───────────────────────────── schema ของแต่ละฟอร์ม ─────────────────────────────

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: required("กรุณากรอกรหัสผ่าน"),
});

export const matchResultSchema = z.object({
  matchId: required("ไม่พบนัดนี้"),
  homeGoals: requiredInt(0, 99, "สกอร์ต้องเป็นจำนวนเต็ม 0–99"),
  awayGoals: requiredInt(0, 99, "สกอร์ต้องเป็นจำนวนเต็ม 0–99"),
  notes: optionalText,
});

export const matchDetailSchema = z.object({
  matchId: required("ไม่พบนัดนี้"),
  kickoffAt: optionalDate,
  venue: optionalText,
  refereeId: optionalText,
  status: z.preprocess((v) => (v === "" ? undefined : v), matchStatusEnum.optional()),
});

export const matchIdSchema = z.object({
  matchId: required("ไม่พบนัดนี้"),
  reason: optionalText.optional(),
});

export const eventSchema = z
  .object({
    matchId: required("ไม่พบนัดนี้"),
    teamId: required("กรุณาเลือกทีม"),
    playerId: required("กรุณาเลือกนักเตะ"),
    assistPlayerId: optionalText,
    type: eventTypeEnum,
    minute: requiredInt(1, 130, "นาทีต้องอยู่ระหว่าง 1–130"),
    extraMinute: optionalInt,
  })
  .refine((v) => v.assistPlayerId !== v.playerId, {
    message: "ผู้จ่ายบอลกับผู้ทำประตูต้องไม่ใช่คนเดียวกัน",
    path: ["assistPlayerId"],
  });

export const teamSchema = z.object({
  id: optionalText,
  name: required("กรุณากรอกชื่อสโมสร"),
  shortName: optionalText,
  code: optionalText,
  logoUrl: optionalText,
  color: optionalText,
  venue: optionalText,
  city: optionalText,
  founded: optionalInt,
});

export const playerSchema = z.object({
  id: optionalText,
  name: required("กรุณากรอกชื่อนักเตะ"),
  teamId: optionalText,
  number: optionalInt.refine(
    (v) => v === null || (v >= 1 && v <= 99),
    "เบอร์เสื้อต้องอยู่ระหว่าง 1–99",
  ),
  position: positionEnum.default("MF"),
  nationality: optionalText,
  photoUrl: optionalText,
  birthDate: optionalDate,
  active: checkbox,
});

export const seasonSchema = z.object({
  id: optionalText,
  name: required("กรุณากรอกชื่อฤดูกาล"),
  rounds: z
    .string()
    .optional()
    .transform((v) => (v === "2" ? 2 : 1)),
  pointsWin: optionalInt,
  pointsDraw: optionalInt,
  pointsLoss: optionalInt,
  startDate: optionalDate,
  endDate: optionalDate,
});

export const fixtureSchema = z.object({
  seasonId: required("ไม่พบฤดูกาล"),
  startDate: optionalDate,
  kickoffTime: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim() || "19:00")
    .refine((v) => /^\d{1,2}:\d{2}$/.test(v), "รูปแบบเวลาไม่ถูกต้อง"),
  daysBetween: intWithDefault(7, 1, 60, "ระยะห่างต้องอยู่ระหว่าง 1–60 วัน"),
  rounds: z
    .string()
    .optional()
    .transform((v) => (v === "2" ? 2 : 1) as 1 | 2),
  shuffle: checkbox,
});

export const zoneSchema = z.object({
  id: optionalText,
  seasonId: required("ไม่พบฤดูกาล"),
  label: optionalText,
  color: optionalText,
  fromPos: optionalInt,
  toPos: optionalInt,
  _delete: optionalText,
});

export const userSchema = z.object({
  id: optionalText,
  name: required("กรุณากรอกชื่อ"),
  email: z.string().trim().toLowerCase().email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: z.string().optional().transform((v) => v ?? ""),
  role: roleEnum.default("REFEREE"),
  active: checkbox,
});

export const idSchema = z.object({ id: required("ไม่พบรายการนี้") });

export const seasonTeamSchema = z.object({
  seasonId: required("ไม่พบฤดูกาล"),
  teamId: required("ไม่พบสโมสร"),
});

export const eventIdSchema = z.object({ eventId: required("ไม่พบเหตุการณ์นี้") });
