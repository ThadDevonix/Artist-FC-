import { getSession } from "@/server/auth";
import { getSeasonBySlug, getTeamById } from "@/server/queries";
import { buildSeasonWorkbook, EXPORT_KINDS, type ExportKind, type ExportScope } from "@/server/export";

/**
 * ดาวน์โหลดไฟล์ Excel — ลิงก์สร้างด้วย exportHref() ใน components/admin/ExcelButton
 *   ?kind=matches&season=2026-27&round=1   การแข่งขันนัดที่ 1
 *   ?kind=players&team=<id>                 นักเตะของสโมสรเดียว
 *   ?kind=clubs&scope=all                   ทุกสโมสรในระบบ
 * เฉพาะผู้ดูแลระบบ (proxy กันไว้ชั้นแรกแล้ว ที่นี่ตรวจซ้ำ)
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "all";
  if (!(kind in EXPORT_KINDS)) return new Response("ไม่รู้จักชุดข้อมูลนี้", { status: 400 });

  const season = await getSeasonBySlug(params.get("season") ?? undefined);
  if (!season) return new Response("ยังไม่มีฤดูกาล", { status: 404 });

  const roundParam = Number(params.get("round"));
  const round = kind === "matches" && Number.isInteger(roundParam) && roundParam > 0 ? roundParam : undefined;

  const teamId = params.get("team");
  const team = teamId ? await getTeamById(teamId) : null;
  if (teamId && !team) return new Response("ไม่พบสโมสร", { status: 404 });
  const scope: ExportScope = team ? { teamId: team.id } : params.get("scope") === "all" ? "all" : "season";

  const file = await buildSeasonWorkbook(season, kind as ExportKind, { round, scope });
  const label = [
    "ArtistFC",
    team ? team.name : scope === "all" ? null : season.name,
    EXPORT_KINDS[kind as ExportKind],
    round ? `นัดที่ ${round}` : null,
  ];
  const filename = `${label.filter(Boolean).join(" ")}.xlsx`;

  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // ชื่อไฟล์ภาษาไทยต้องเข้ารหัสแบบ RFC 5987 · filename= สำรองสำหรับโปรแกรมที่อ่านไม่ได้
      "Content-Disposition": `attachment; filename="artistfc-${kind}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
