import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/server/db";
import { getStandings } from "@/server/queries/standings";
import { getPlayerSeasonStats } from "@/server/queries/stats";
import { MATCH_STATUS_LABEL, POSITION_LABEL, STAFF_ROLES, staffRoleName } from "@/lib/labels";
import { ageFrom, toThaiDate, toThaiTime } from "@/lib/format";

/**
 * ไฟล์ Excel สำหรับหลังบ้าน — แต่ละชุดข้อมูลเป็น 1 ชีต เลือกโหลดทีละชีตหรือรวมทุกชีตก็ได้
 * ปุ่มอยู่ในหน้าที่เกี่ยวข้อง (ตารางคะแนนที่หน้าฤดูกาล การแข่งขันที่หน้าบันทึกผล สโมสร/นักเตะที่หน้าสโมสร)
 *
 * ขอบเขตสโมสร/นักเตะ/ทีมงาน:
 *   club   — สโมสรเดียว (หน้าของสโมสรนั้น)
 *   all    — ทุกสโมสรในระบบ (หน้ารวมสโมสร)
 *   season — เฉพาะสโมสรในฤดูกาล (ค่าตั้งต้น)
 * สถิตินักเตะนับจากฤดูกาลที่ส่งมาเสมอ
 */

export const EXPORT_KINDS = {
  clubs: "สโมสร",
  standings: "ตารางคะแนน",
  matches: "การแข่งขัน",
  players: "นักเตะ",
  staff: "ทีมงาน",
  all: "ทั้งหมด",
} as const;

export type ExportKind = keyof typeof EXPORT_KINDS;

type Season = { id: string; name: string };
export type ExportScope = { teamId: string } | "all" | "season";
type Column = { header: string; key: string; width: number; date?: boolean };
type Cell = string | number | Date | null;

/** สีแบรนด์ (ส้ม) ที่หัวตาราง */
const HEADER_FILL = "FFF97316";

/**
 * วันที่ตามเวลาไทยเป็นค่าวันที่ของ Excel — Excel ไม่มีเขตเวลา จึงเก็บวัน/เดือน/ปีแบบ UTC ตรง ๆ
 * (ไม่งั้นนัดตี 1 เวลาไทยจะกลายเป็นวันก่อนหน้า)
 */
const excelDate = (date: Date | null) => (date ? new Date(`${toThaiDate(date)}T00:00:00Z`) : null);

function addSheet(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, Cell>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
    ...(c.date ? { style: { numFmt: "dd/mm/yyyy" } } : {}),
  }));
  ws.addRows(rows);

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

/** เงื่อนไขสโมสรตามขอบเขต — ไม่รวมช่องทีมชั่วคราว ("ทีม 3") */
function teamWhere(seasonId: string, scope: ExportScope) {
  if (typeof scope === "object") return { id: scope.teamId, isPlaceholder: false };
  if (scope === "all") return { isPlaceholder: false };
  return { seasons: { some: { seasonId } }, isPlaceholder: false };
}

async function clubsSheet(wb: ExcelJS.Workbook, season: Season, scope: ExportScope) {
  const clubs = await db.team.findMany({
    where: teamWhere(season.id, scope),
    orderBy: { name: "asc" },
    include: { _count: { select: { players: { where: { active: true } }, staff: { where: { active: true } } } } },
  });
  addSheet(
    wb,
    EXPORT_KINDS.clubs,
    [
      { header: "ลำดับ", key: "no", width: 7 },
      { header: "สโมสร", key: "name", width: 28 },
      { header: "ชื่อย่อ", key: "shortName", width: 16 },
      { header: "ตัวย่อ", key: "code", width: 8 },
      { header: "สนามเหย้า", key: "venue", width: 26 },
      { header: "จังหวัด", key: "city", width: 16 },
      { header: "ก่อตั้ง", key: "founded", width: 9 },
      { header: "นักเตะ", key: "players", width: 9 },
      { header: "ทีมงาน", key: "staff", width: 9 },
    ],
    clubs.map((t, i) => ({
      no: i + 1,
      name: t.name,
      shortName: t.shortName,
      code: t.code,
      venue: t.venue,
      city: t.city,
      founded: t.founded,
      players: t._count.players,
      staff: t._count.staff,
    })),
  );
}

async function standingsSheet(wb: ExcelJS.Workbook, season: Season) {
  // ตารางทางการ — ไม่นับสกอร์ของนัดที่กำลังแข่งอยู่
  const { rows } = await getStandings(season.id, { includeLive: false });
  const formLabel = { W: "ช", D: "ส", L: "พ" } as const;
  addSheet(
    wb,
    EXPORT_KINDS.standings,
    [
      { header: "อันดับ", key: "position", width: 8 },
      { header: "สโมสร", key: "team", width: 28 },
      { header: "แข่ง", key: "played", width: 7 },
      { header: "ชนะ", key: "won", width: 7 },
      { header: "เสมอ", key: "drawn", width: 7 },
      { header: "แพ้", key: "lost", width: 7 },
      { header: "ได้", key: "goalsFor", width: 7 },
      { header: "เสีย", key: "goalsAgainst", width: 7 },
      { header: "ต่าง", key: "goalDiff", width: 7 },
      { header: "แต้ม", key: "points", width: 7 },
      { header: "ฟอร์ม 5 นัดล่าสุด", key: "form", width: 18 },
    ],
    rows.map((r) => ({
      position: r.position,
      team: r.team.name,
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      goalsFor: r.goalsFor,
      goalsAgainst: r.goalsAgainst,
      goalDiff: r.goalDiff,
      points: r.points,
      form: r.form.map((f) => formLabel[f.result]).join(" "),
    })),
  );
}

async function matchesSheet(wb: ExcelJS.Workbook, season: Season, round?: number) {
  const name = { select: { name: true } };
  const matches = await db.match.findMany({
    where: { seasonId: season.id, ...(round ? { round } : {}) },
    orderBy: [{ round: "asc" }, { kickoffAt: "asc" }, { createdAt: "asc" }],
    include: {
      homeTeam: name,
      awayTeam: name,
      referee: name,
      assistant1: name,
      assistant2: name,
      fourthOfficial: name,
    },
  });
  addSheet(
    wb,
    round ? `${EXPORT_KINDS.matches} นัดที่ ${round}` : EXPORT_KINDS.matches,
    [
      { header: "นัดที่", key: "round", width: 7 },
      { header: "วันที่", key: "date", width: 12, date: true },
      { header: "เวลา", key: "time", width: 8 },
      { header: "เจ้าบ้าน", key: "home", width: 24 },
      { header: "ประตูเจ้าบ้าน", key: "homeGoals", width: 12 },
      { header: "ประตูทีมเยือน", key: "awayGoals", width: 12 },
      { header: "ทีมเยือน", key: "away", width: 24 },
      { header: "สนาม", key: "venue", width: 24 },
      { header: "สถานะ", key: "status", width: 12 },
      { header: "ผู้ตัดสิน", key: "referee", width: 20 },
      { header: "ผู้ช่วยผู้ตัดสิน 1", key: "assistant1", width: 20 },
      { header: "ผู้ช่วยผู้ตัดสิน 2", key: "assistant2", width: 20 },
      { header: "ผู้ตัดสินที่ 4", key: "fourth", width: 20 },
    ],
    matches.map((m) => ({
      round: m.round,
      date: excelDate(m.kickoffAt),
      time: m.kickoffAt ? toThaiTime(m.kickoffAt) : "รอกำหนด",
      home: m.homeTeam.name,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      away: m.awayTeam.name,
      venue: m.venue,
      status: MATCH_STATUS_LABEL[m.status],
      referee: m.referee?.name ?? null,
      assistant1: m.assistant1?.name ?? null,
      assistant2: m.assistant2?.name ?? null,
      fourth: m.fourthOfficial?.name ?? null,
    })),
  );
}

async function playersSheet(wb: ExcelJS.Workbook, season: Season, scope: ExportScope) {
  const [players, stats] = await Promise.all([
    db.player.findMany({
      where: { team: teamWhere(season.id, scope) },
      orderBy: [{ team: { name: "asc" } }, { number: { sort: "asc", nulls: "last" } }, { name: "asc" }],
      include: { team: { select: { name: true } } },
    }),
    getPlayerSeasonStats(season.id),
  ]);
  addSheet(
    wb,
    EXPORT_KINDS.players,
    [
      { header: "สโมสร", key: "team", width: 24 },
      { header: "เบอร์", key: "number", width: 7 },
      { header: "ชื่อ", key: "name", width: 28 },
      { header: "ตำแหน่ง", key: "position", width: 14 },
      { header: "สัญชาติ", key: "nationality", width: 12 },
      { header: "วันเกิด", key: "birthDate", width: 12, date: true },
      { header: "อายุ", key: "age", width: 7 },
      { header: "สถานะ", key: "active", width: 10 },
      { header: `ประตู ${season.name}`, key: "goals", width: 14 },
      { header: "แอสซิสต์", key: "assists", width: 9 },
      { header: "ใบเหลือง", key: "yellow", width: 9 },
      { header: "ใบแดง", key: "red", width: 8 },
    ],
    players.map((p) => {
      const s = stats.get(p.id);
      return {
        team: p.team.name,
        number: p.number,
        name: p.name,
        position: POSITION_LABEL[p.position],
        nationality: p.nationality,
        birthDate: excelDate(p.birthDate),
        age: ageFrom(p.birthDate),
        active: p.active ? "อยู่ในทีม" : "ออกจากทีม",
        goals: s?.goals ?? 0,
        assists: s?.assists ?? 0,
        yellow: s?.yellow ?? 0,
        red: s?.red ?? 0,
      };
    }),
  );
}

async function staffSheet(wb: ExcelJS.Workbook, season: Season, scope: ExportScope) {
  const staff = await db.staff.findMany({
    where: { team: teamWhere(season.id, scope) },
    orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    include: { team: { select: { name: true } } },
  });
  // เรียงตำแหน่งแบบเดียวกับหน้าเว็บ (ประธาน → ผู้จัดการ → โค้ช …)
  staff.sort(
    (a, b) => a.team.name.localeCompare(b.team.name, "th") || STAFF_ROLES.indexOf(a.role) - STAFF_ROLES.indexOf(b.role),
  );
  addSheet(
    wb,
    EXPORT_KINDS.staff,
    [
      { header: "สโมสร", key: "team", width: 24 },
      { header: "ชื่อ", key: "name", width: 28 },
      { header: "ตำแหน่ง", key: "role", width: 22 },
      { header: "สัญชาติ", key: "nationality", width: 12 },
      { header: "สถานะ", key: "active", width: 10 },
    ],
    staff.map((s) => ({
      team: s.team.name,
      name: s.name,
      role: staffRoleName(s),
      nationality: s.nationality,
      active: s.active ? "อยู่ในทีม" : "ออกจากทีม",
    })),
  );
}

/** สร้างไฟล์ .xlsx — round ใช้กับชีตการแข่งขันเท่านั้น (ว่าง = ทุกนัด) */
export async function buildSeasonWorkbook(
  season: Season,
  kind: ExportKind,
  { round, scope = "season" }: { round?: number; scope?: ExportScope } = {},
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Artist FC";
  wb.created = new Date();

  if (kind === "clubs" || kind === "all") await clubsSheet(wb, season, scope);
  if (kind === "standings" || kind === "all") await standingsSheet(wb, season);
  if (kind === "matches" || kind === "all") await matchesSheet(wb, season, kind === "matches" ? round : undefined);
  if (kind === "players" || kind === "all") await playersSheet(wb, season, scope);
  if (kind === "staff" || kind === "all") await staffSheet(wb, season, scope);

  return wb.xlsx.writeBuffer();
}
