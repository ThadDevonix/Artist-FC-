import "server-only";
import { db } from "@/server/db";

/** ฤดูกาลที่กำลังใช้งานอยู่ ถ้าไม่มีให้ใช้ฤดูกาลล่าสุด */
export async function getActiveSeason() {
  return (
    (await db.season.findFirst({ where: { isActive: true } })) ??
    (await db.season.findFirst({ orderBy: { createdAt: "desc" } }))
  );
}

export async function getSeasonBySlug(slug?: string) {
  if (!slug) return getActiveSeason();
  return (await db.season.findUnique({ where: { slug } })) ?? getActiveSeason();
}

export async function listSeasons() {
  return db.season.findMany({ orderBy: { name: "desc" } });
}

export async function listSeasonZones(seasonId: string) {
  return db.zone.findMany({ where: { seasonId }, orderBy: { fromPos: "asc" } });
}
