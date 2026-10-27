/**
 * ข้อความภาษาไทยของค่าคงที่ทุกตัวในระบบ รวมไว้ที่เดียว
 *
 * ทำไมต้องรวม: เดิมป้ายข้อความกระจายอยู่ในหน้าเพจและ component ทำให้เวลาจะแก้คำ
 * ต้องไล่หาหลายที่ และมีโอกาสแก้ไม่ครบจนคำไม่ตรงกันระหว่างหน้า
 *
 * ไฟล์นี้ไม่พึ่งพาอะไรเลย (ไม่มี DB / React) เรียกใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
 */

import type { EventType, MatchStatus, Position, Role } from "@/generated/prisma/enums";

// ───────────────────────────── สถานะการแข่งขัน ─────────────────────────────

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SCHEDULED: "ยังไม่แข่ง",
  LIVE: "กำลังแข่ง",
  PENDING: "รออนุมัติ",
  FINISHED: "อนุมัติแล้ว",
  POSTPONED: "เลื่อน",
  CANCELLED: "ยกเลิก",
};

/** คลาสสีของชิปสถานะ — มีค่าสำหรับโหมดมืดด้วย */
export const MATCH_STATUS_STYLE: Record<MatchStatus, string> = {
  SCHEDULED: "bg-canvas text-muted",
  LIVE: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  FINISHED: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  POSTPONED: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  CANCELLED: "bg-canvas text-muted",
};

/** สถานะที่ถือว่า "ยังไม่จบ" ใช้กรองนัดที่กำลังจะมาถึง */
export const UPCOMING_STATUSES: MatchStatus[] = ["SCHEDULED", "LIVE", "POSTPONED"];

/** สถานะที่มีผลบันทึกไว้แล้ว ห้ามลบตารางแข่งทับ */
export const LOCKED_STATUSES: MatchStatus[] = ["FINISHED", "PENDING"];

// ───────────────────────────── ตำแหน่งผู้เล่น ─────────────────────────────

export const POSITION_LABEL: Record<Position, string> = {
  GK: "ผู้รักษาประตู",
  DF: "กองหลัง",
  MF: "กองกลาง",
  FW: "กองหน้า",
};

export const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];

// ───────────────────────────── เหตุการณ์ในเกม ─────────────────────────────

export const EVENT_LABEL: Record<EventType, string> = {
  GOAL: "ทำประตู",
  PENALTY_GOAL: "ทำประตูจากจุดโทษ",
  OWN_GOAL: "ทำเข้าประตูตัวเอง",
  PENALTY_MISS: "ยิงจุดโทษไม่เข้า",
  YELLOW: "ใบเหลือง",
  SECOND_YELLOW: "ใบเหลืองใบที่สอง",
  RED: "ใบแดง",
};

export const EVENT_TYPES: EventType[] = [
  "GOAL", "PENALTY_GOAL", "OWN_GOAL", "PENALTY_MISS", "YELLOW", "SECOND_YELLOW", "RED",
];

/** ประตูที่นับเป็นผลงานของผู้ยิง (ไม่รวมการทำเข้าประตูตัวเอง) */
export const SCORING_EVENTS: EventType[] = ["GOAL", "PENALTY_GOAL"];
export const BOOKING_EVENTS: EventType[] = ["YELLOW", "SECOND_YELLOW"];

// ───────────────────────────── สิทธิ์ผู้ใช้ ─────────────────────────────

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  REFEREE: "กรรมการ",
};

// ───────────────────────────── ประวัติการแก้ไข ─────────────────────────────

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  MATCH_SUBMIT: "ส่งผลการแข่งขัน",
  MATCH_SAVE_APPROVED: "บันทึกและอนุมัติผล",
  MATCH_APPROVE: "อนุมัติผล",
  MATCH_REJECT: "ตีกลับผล",
  MATCH_UPDATE: "แก้ไขรายละเอียดนัด",
  EVENT_ADD: "เพิ่มเหตุการณ์",
  EVENT_DELETE: "ลบเหตุการณ์",
  TEAM_CREATE: "เพิ่มสโมสร",
  TEAM_UPDATE: "แก้ไขสโมสร",
  TEAM_DELETE: "ลบสโมสร",
  PLAYER_CREATE: "เพิ่มนักเตะ",
  PLAYER_UPDATE: "แก้ไขนักเตะ",
  PLAYER_DELETE: "ลบนักเตะ",
  PLAYER_IMPORT: "นำเข้ารายชื่อนักเตะ",
  SEASON_CREATE: "สร้างฤดูกาล",
  SEASON_UPDATE: "แก้ไขฤดูกาล",
  SEASON_ACTIVATE: "เปลี่ยนฤดูกาลที่ใช้งาน",
  SEASON_TEAM_TOGGLE: "เพิ่ม/เอาทีมออกจากฤดูกาล",
  FIXTURES_GENERATE: "สร้างตารางแข่ง",
  ZONE_SAVE: "แก้ไขโซนตารางคะแนน",
  USER_CREATE: "เพิ่มผู้ใช้",
  USER_UPDATE: "แก้ไขผู้ใช้",
  USER_DELETE: "ลบผู้ใช้",
};

export function auditLabel(action: string) {
  return AUDIT_ACTION_LABEL[action] ?? action;
}
