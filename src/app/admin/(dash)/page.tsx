import Link from "next/link";
import { Card, StatusPill, TeamBadge } from "@/components/ui";
import { requireSession } from "@/server/auth";
import {
  countSeasonTeams,
  getActiveSeason,
  getSeasonMatchCounts,
  listPendingMatches,
  listUpcomingMatches,
  recentAuditLogs,
} from "@/server/queries";
import { thaiDateTime } from "@/lib/format";

export const metadata = { title: "ภาพรวมหลังบ้าน" };

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const session = await requireSession();
  const admin = session.role === "ADMIN";
  const season = await getActiveSeason();

  if (!season) {
    return (
      <Card>
        <div className="px-5 py-12 text-center">
          <p className="text-muted">ยังไม่มีฤดูกาลในระบบ</p>
          {admin && (
            <Link href="/admin/seasons" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              สร้างฤดูกาลแรก
            </Link>
          )}
        </div>
      </Card>
    );
  }

  const [counts, teamCount, pending, myNext, recentLogs] = await Promise.all([
    getSeasonMatchCounts(season.id),
    countSeasonTeams(season.id),
    admin ? listPendingMatches(season.id) : Promise.resolve([]),
    listUpcomingMatches(season.id, admin ? {} : { refereeId: session.userId }),
    admin ? recentAuditLogs() : Promise.resolve([]),
  ]);

  const { total, finished, pending: pendingCount } = counts;

  return (
    <div className="space-y-6">
      {sp.error === "forbidden" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          คุณไม่มีสิทธิ์เข้าหน้านั้น
        </p>
      )}

      <div>
        <h1 className="text-2xl font-bold">สวัสดี {session.name}</h1>
        <p className="mt-1 text-sm text-muted">
          ฤดูกาล {season.name}
          {!admin && " · คุณเห็นเฉพาะนัดที่ได้รับมอบหมายให้เป็นผู้ตัดสิน"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="นัดทั้งหมด" value={total} />
        <Stat label="อนุมัติแล้ว" value={finished} />
        <Stat label="รออนุมัติ" value={pendingCount} highlight={pendingCount > 0} />
        <Stat label="สโมสร" value={teamCount} />
      </div>

      {admin && (
        <Card
          title="ผลที่รออนุมัติ"
          action={<Link href="/admin/matches?status=PENDING" className="text-sm text-muted hover:text-ink">ดูทั้งหมด</Link>}
        >
          {pending.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">ไม่มีผลค้างอนุมัติ</p>
          ) : (
            <ul>
              {pending.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/matches/${m.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas sm:px-5">
                    <span className="w-14 shrink-0 text-xs text-muted">นัดที่ {m.round}</span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <TeamBadge name={m.homeTeam.name} logoUrl={m.homeTeam.logoUrl} color={m.homeTeam.color} color2={m.homeTeam.color2} size={20} />
                      <span className="truncate">{m.homeTeam.shortName}</span>
                      <span className="shrink-0 font-bold tnum">{m.homeGoals}–{m.awayGoals}</span>
                      <span className="truncate">{m.awayTeam.shortName}</span>
                      <TeamBadge name={m.awayTeam.name} logoUrl={m.awayTeam.logoUrl} color={m.awayTeam.color} color2={m.awayTeam.color2} size={20} />
                    </span>
                    <span className="hidden shrink-0 text-xs text-muted sm:block">
                      ส่งโดย {m.submittedBy?.name ?? "—"}
                    </span>
                    <StatusPill status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title={admin ? "นัดถัดไป" : "นัดที่คุณต้องตัดสิน"}
          action={<Link href="/admin/matches" className="text-sm text-muted hover:text-ink">ทั้งหมด</Link>}
        >
          {myNext.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">ไม่มีนัดที่รอแข่ง</p>
          ) : (
            <ul>
              {myNext.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/matches/${m.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-canvas sm:px-5">
                    <span className="w-28 shrink-0 text-xs text-muted">{thaiDateTime(m.kickoffAt)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {m.homeTeam.shortName} <span className="text-muted">พบ</span> {m.awayTeam.shortName}
                    </span>
                    <span className="shrink-0 text-xs text-muted">นัดที่ {m.round}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {admin && (
          <Card
            title="ประวัติการแก้ไขล่าสุด"
            action={<Link href="/admin/activity" className="text-sm text-muted hover:text-ink">ทั้งหมด</Link>}
          >
            {recentLogs.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">ยังไม่มีประวัติ</p>
            ) : (
              <ul>
                {recentLogs.map((log) => (
                  <li key={log.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0 sm:px-5">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{log.user?.name ?? "ระบบ"}</span>{" "}
                      <span className="text-muted">{log.action}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{thaiDateTime(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${highlight ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40" : "border-line bg-surface"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tnum">{value}</div>
    </div>
  );
}
