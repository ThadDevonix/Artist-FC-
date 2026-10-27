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
import { EVENT_TYPES, POSITIONS, STAFF_ROLES } from "@/lib/labels";
import { fromThaiDateTime } from "@/lib/format";
import type { EventType, MatchStatus, Position, Role, StaffRole } from "@/generated/prisma/enums";

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

/** จำนวนทีมสูงสุดต่อฤดูกาล */
export const MAX_TEAMS = 40;

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
    if (!text) return null;
    // วันที่+เวลาจาก datetime-local ไม่มีเขตเวลาติดมา → ถือเป็นเวลาไทย (ไม่งั้นบน Vercel จะเพี้ยน 7 ชม.)
    const local = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/.exec(text);
    return local ? fromThaiDateTime(local[1], local[2]) : new Date(text);
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

export const staffRoleEnum = z.enum(
  STAFF_ROLES as [StaffRole, ...StaffRole[]],
) satisfies z.ZodType<StaffRole>;

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

export const matchDetailSchema = z
  .object({
    matchId: required("ไม่พบนัดนี้"),
    kickoffAt: optionalDate,
    venue: optionalText,
    refereeId: optionalText,
    assistant1Id: optionalText,
    assistant2Id: optionalText,
    fourthOfficialId: optionalText,
    status: z.preprocess((v) => (v === "" ? undefined : v), matchStatusEnum.optional()),
  })
  .refine(
    (v) => {
      const chosen = [v.refereeId, v.assistant1Id, v.assistant2Id, v.fourthOfficialId].filter(Boolean);
      return new Set(chosen).size === chosen.length;
    },
    { message: "ผู้ตัดสิน 1 คนอยู่ได้แค่ตำแหน่งเดียวในนัดเดียวกัน" },
  );

export const officialSchema = z.object({
  id: optionalText,
  name: required("กรุณากรอกชื่อผู้ตัดสิน"),
  level: optionalText,
  nationality: optionalText,
  userId: optionalText,
  photoData: optionalText,
  removePhoto: checkbox,
  active: checkbox,
});

export const livePhaseSchema = z.object({
  matchId: required("ไม่พบนัดนี้"),
  phase: z.enum(["HALF_TIME", "SECOND_HALF"]),
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
    issuedById: optionalText,
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
  useColor2: optionalText,
  color2: optionalText,
  venue: optionalText,
  city: optionalText,
  founded: optionalInt,
});

export const playerSchema = z.object({
  id: optionalText,
  name: required("กรุณากรอกชื่อนักเตะ"),
  teamId: required("นักเตะต้องมีสังกัดทีม"),
  number: optionalInt.refine(
    (v) => v === null || (v >= 1 && v <= 99),
    "เบอร์เสื้อต้องอยู่ระหว่าง 1–99",
  ),
  position: positionEnum.default("MF"),
  nationality: optionalText,
  photoData: optionalText, // รูปใหม่ที่ย่อจากเบราว์เซอร์แล้ว (data URL)
  removePhoto: checkbox,
  birthDate: optionalDate,
  active: checkbox,
});

export const staffSchema = z
  .object({
    id: optionalText,
    teamId: required("ทีมงานต้องมีสังกัดทีม"),
    name: required("กรุณากรอกชื่อ"),
    role: staffRoleEnum,
    roleLabel: optionalText,
    nationality: optionalText,
    photoData: optionalText,
    removePhoto: checkbox,
    active: checkbox,
  })
  .refine((v) => v.role !== "OTHER" || v.roleLabel, {
    message: "เลือก \"อื่นๆ\" แล้วกรุณาพิมพ์ชื่อตำแหน่ง",
    path: ["roleLabel"],
  });

export const seasonDeleteSchema = z.object({
  id: required("ไม่พบฤดูกาล"),
  confirmName: z.string().optional().transform((v) => (v ?? "").trim()),
});

export const rosterImportSchema = z.object({
  teamId: required("ไม่พบทีม"),
  text: required("ยังไม่มีรายชื่อให้นำเข้า"),
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
  halfMinutes: optionalInt.refine((v) => v === null || (v >= 10 && v <= 60), "ความยาวครึ่งต้องอยู่ระหว่าง 10–60 นาที"),
  startDate: optionalDate,
  endDate: optionalDate,
  // จำนวนทีมในตารางแข่ง — มีเฉพาะฟอร์มสร้างฤดูกาล เว้นว่าง = ยังไม่สร้างตาราง
  teamCount: optionalInt.refine((v) => v === null || (v >= 2 && v <= MAX_TEAMS), `จำนวนทีมต้องอยู่ระหว่าง 2–${MAX_TEAMS}`),
});

/** สร้างตารางใหม่จากหน้าฤดูกาล — ยังไม่กำหนดวันเวลา */
export const fixtureSchema = z.object({
  seasonId: required("ไม่พบฤดูกาล"),
  teamCount: requiredInt(2, MAX_TEAMS, `จำนวนทีมต้องอยู่ระหว่าง 2–${MAX_TEAMS}`),
  rounds: z
    .string()
    .optional()
    .transform((v) => (v === "2" ? 2 : 1) as 1 | 2),
  shuffle: checkbox,
});

/** ตั้งวันเวลาทุกนัดที่ยังไม่แข่งแบบอัตโนมัติ (หน้าจัดวันเวลาแข่ง) */
export const autoScheduleSchema = z.object({
  seasonId: required("ไม่พบฤดูกาล"),
  startDate: optionalDate,
  // เวลาเตะหลายเวลา คั่นด้วยลูกน้ำ เช่น "19:00, 20:30" — คู่ในวันเดียวกันไล่ใช้ตามลำดับ
  kickoffTimes: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(/[,\s]+/)
        .map((t) => t.trim().replace(".", ":"))
        .filter(Boolean)
        .map((t) => (/^\d:\d{2}$/.test(t) ? `0${t}` : t)),
    )
    .refine((v) => v.length > 0, "กรุณาใส่เวลาเตะอย่างน้อย 1 เวลา")
    .refine((v) => v.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)), "รูปแบบเวลาไม่ถูกต้อง (เช่น 19:00, 20:30)"),
  weeksBetween: intWithDefault(1, 1, 8, "แต่ละนัดห่างกันได้ 1–8 สัปดาห์"),
});

/** ใส่สโมสรจริงลงช่องทีม (แทน "ทีม 3") */
export const assignSlotSchema = z.object({
  seasonTeamId: required("ไม่พบช่องทีม"),
  teamId: required("กรุณาเลือกสโมสร"),
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
