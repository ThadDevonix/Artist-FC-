import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { computeStandings, parseTiebreakers, type StandingRow } from "@/lib/standings";
import { decidingTie, parseSource, sourceTeamName, tieWinner } from "@/lib/knockout";

type Client = Prisma.TransactionClient | typeof db;

/** สถานะที่ยังเปลี่ยนทีมในนัดได้ (ยังไม่ได้เตะ) */
const OPEN = ["SCHEDULED", "POSTPONED", "CANCELLED"] as const;

/** slug ของทีมชั่วคราวในสายน็อคเอาต์ — ใช้ทั้งหาและลบตอนลบฤดูกาล/สร้างตารางใหม่ */
export const koPlaceholderPrefix = (seasonId: string) => `ko-${seasonId}-`;

/** ทีมชั่วคราวของ source นี้ (สร้างถ้ายังไม่มี) เช่น "ที่ 1 กลุ่ม A" */
export async function koPlaceholder(client: Client, seasonId: string, source: string) {
  const slug = `${koPlaceholderPrefix(seasonId)}${source.replace(/:/g, "-")}`;
  const found = await client.team.findUnique({ where: { slug }, select: { id: true } });
  if (found) return found.id;
  const { name, shortName, code } = sourceTeamName(source);
  const team = await client.team.create({
    data: { name, shortName, code, slug, color: "#9ca3af", isPlaceholder: true },
    select: { id: true },
  });
  return team.id;
}

/**
 * ตารางคะแนนแยกกลุ่ม จากนัดในกลุ่มเท่านั้น (นัดน็อคเอาต์ไม่นับ)
 * includeLive = นับนัดที่กำลังแข่งด้วยสกอร์ปัจจุบัน (หน้าเว็บ) · false = เฉพาะผลที่อนุมัติแล้ว (ใช้ตัดสินทีมเข้ารอบ)
 */
export async function groupTables(client: Client, seasonId: string, includeLive: boolean) {
  const [season, entries, matches] = await Promise.all([
    client.season.findUnique({ where: { id: seasonId } }),
    client.seasonTeam.findMany({
      where: { seasonId, group: { not: null } },
      orderBy: [{ slot: "asc" }],
      select: {
        group: true,
        team: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, color: true, color2: true } },
      },
    }),
    client.match.findMany({
      where: { seasonId, group: { not: null } },
      select: { id: true, round: true, kickoffAt: true, status: true, group: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
    }),
  ]);
  if (!season) return [];

  const counted = includeLive ? ["FINISHED", "LIVE"] : ["FINISHED"];
  const tables: { group: number; rows: StandingRow[]; complete: boolean }[] = [];
  for (let g = 1; g <= season.groupCount; g++) {
    const inGroup = matches.filter((m) => m.group === g);
    const rows = computeStandings(
      entries.filter((e) => e.group === g).map((e) => e.team),
      inGroup
        .filter((m) => counted.includes(m.status) && m.homeGoals !== null && m.awayGoals !== null)
        .map((m) => ({ ...m, homeGoals: m.homeGoals!, awayGoals: m.awayGoals! })),
      {
        points: { win: season.pointsWin, draw: season.pointsDraw, loss: season.pointsLoss },
        tiebreakers: parseTiebreakers(season.tiebreakers),
      },
    );
    // กลุ่มจบแล้ว = ทุกนัดในกลุ่มอนุมัติผล (นัดที่ยกเลิกไม่ต้องรอ)
    const complete = inGroup.length > 0 && inGroup.every((m) => m.status === "FINISHED" || m.status === "CANCELLED");
    tables.push({ group: g, rows, complete });
  }
  return tables;
}

/**
 * ใส่ทีมจริงลงสายน็อคเอาต์ตามผลล่าสุด — เรียกทุกครั้งที่ผลการแข่งขันเปลี่ยน
 * - กลุ่มจบครบทุกนัด → ใส่ทีมตามอันดับ (เช่น ที่ 1 กลุ่ม A)
 * - คู่น็อคเอาต์รู้ผล → ใส่ผู้ชนะลงคู่ถัดไป
 * - ยังไม่รู้ (หรือผลถูกตีกลับ) → คืนเป็นทีมชั่วคราว
 * แตะเฉพาะนัดที่ยังไม่ได้เตะ นัดที่แข่งไปแล้วคงทีมเดิม · ฤดูกาลแบบลีกไม่ทำอะไร
 */
export async function syncBracket(seasonId: string, client: Client = db) {
  const season = await client.season.findUnique({ where: { id: seasonId }, select: { format: true } });
  if (season?.format !== "CUP") return;

  const [tables, koMatches] = await Promise.all([
    groupTables(client, seasonId, false),
    client.match.findMany({
      where: { seasonId, koSize: { not: null } },
      select: {
        id: true, status: true, koSize: true, koSlot: true, leg: true, homeSource: true, awaySource: true,
        homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, homePens: true, awayPens: true,
      },
    }),
  ]);

  const resolve = (source: string | null): string | null => {
    const s = source ? parseSource(source) : null;
    if (!s) return null;
    if (s.kind === "group") {
      const table = tables.find((t) => t.group === s.group);
      return table?.complete ? (table.rows[s.pos - 1]?.team.id ?? null) : null;
    }
    return tieWinner(koMatches.filter((m) => m.koSize === s.size && m.koSlot === s.slot));
  };

  for (const m of koMatches) {
    if (!(OPEN as readonly string[]).includes(m.status) || !m.homeSource || !m.awaySource) continue;
    const home = resolve(m.homeSource) ?? (await koPlaceholder(client, seasonId, m.homeSource));
    const away = resolve(m.awaySource) ?? (await koPlaceholder(client, seasonId, m.awaySource));
    if (home === m.homeTeamId && away === m.awayTeamId) continue;
    await client.match.update({ where: { id: m.id }, data: { homeTeamId: home, awayTeamId: away } });
  }
}

/**
 * สถานะคู่น็อคเอาต์ของนัดนี้ — null = ไม่ใช่นัดน็อคเอาต์
 * deciding = เป็นนัดตัดสิน (นัดเดียว / นัดสองของเหย้า-เยือน) · level = ประตูรวมเสมอถ้าจบด้วยสกอร์ score
 * ใช้ตัดสินว่ามีปุ่มต่อเวลาไหม และต้องกรอกผลจุดโทษไหม (ทั้งบนหน้าเว็บและตอนบันทึกจริง)
 */
export async function tieContext(matchId: string, score?: { homeGoals: number; awayGoals: number }) {
  const m = await db.match.findUnique({
    where: { id: matchId },
    select: {
      seasonId: true, koSize: true, koSlot: true, leg: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true,
      season: { select: { extraTime: true, penalties: true } },
    },
  });
  if (!m?.koSize) return null;
  const firstLeg =
    m.leg === 2
      ? await db.match.findFirst({
          where: { seasonId: m.seasonId, koSize: m.koSize, koSlot: m.koSlot, leg: 1 },
          select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
        })
      : null;
  const { deciding, level } = decidingTie(m, score ?? { homeGoals: m.homeGoals ?? 0, awayGoals: m.awayGoals ?? 0 }, firstLeg);
  return { deciding, level, firstLeg, extraTime: m.season.extraTime, penalties: m.season.penalties };
}
