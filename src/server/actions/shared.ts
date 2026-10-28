import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";

/**
 * รีเฟรชทุกหน้าหลังข้อมูลเปลี่ยน
 *
 * ใช้แบบเหมารวมเพราะข้อมูลในระบบนี้เกี่ยวพันกันหมด — บันทึกผลนัดเดียว
 * กระทบตารางคะแนน สถิตินักเตะ โปรไฟล์ทั้งสองทีม และหน้าแรก
 * การไล่ระบุทีละ path จะพลาดง่ายกว่าและได้ประโยชน์น้อย เพราะทุกหน้าดึงข้อมูลสดอยู่แล้ว
 */
export function refreshAll() {
  revalidatePath("/", "layout");
}

/** สร้าง slug จากชื่อ — รองรับภาษาไทย (เก็บตัวอักษร สระ/วรรณยุกต์ และตัวเลขทุกภาษา) */
export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || `item-${Date.now()}`
  );
}

/** เติมเลขท้ายจนกว่าจะไม่ซ้ำกับที่มีอยู่ */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base;
  let i = 2;
  while (await exists(slug)) slug = `${base}-${i++}`;
  return slug;
}

export const teamSlugTaken = async (slug: string) =>
  Boolean(await db.team.findUnique({ where: { slug } }));

export const playerSlugTaken = async (slug: string) =>
  Boolean(await db.player.findUnique({ where: { slug } }));

export const seasonSlugTaken = async (slug: string) =>
  Boolean(await db.season.findUnique({ where: { slug } }));
