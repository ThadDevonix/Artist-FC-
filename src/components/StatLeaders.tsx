import Link from "next/link";
import { Card, PlayerAvatar, TeamBadge } from "@/components/ui";
import { getLeaders, LEADER_LABELS, type LeaderBoard } from "@/server/queries";

const BOARDS: LeaderBoard[] = ["goals", "assists", "yellow", "red"];

/** แผงผู้นำสถิติด้านขวา — แสดงทุกหมวดเรียงลงมา (ไม่ต้องใช้ JS) */
export async function StatLeadersPanel({ seasonId }: { seasonId: string }) {
  const boards = await Promise.all(
    BOARDS.map(async (b) => ({ board: b, rows: await getLeaders(seasonId, b, 5) })),
  );

  return (
    <aside className="space-y-4">
      <Card
        title="ผู้นำสถิติ"
        action={
          <Link href="/stats" className="text-sm text-muted hover:text-ink">
            ดูทั้งหมด
          </Link>
        }
      >
        <div className="divide-y divide-line">
          {boards.map(({ board, rows }) => (
            <div key={board} className="px-4 py-3 sm:px-5">
              <h3 className="mb-2 text-sm font-semibold text-muted">
                {LEADER_LABELS[board]}
              </h3>
              {rows.length === 0 ? (
                <p className="py-2 text-sm text-muted">ยังไม่มีข้อมูล</p>
              ) : (
                <ol className="space-y-2">
                  {rows.slice(0, 3).map((r, i) => (
                    <li key={r.playerId} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-sm text-muted tnum">{i + 1}</span>
                      <Link
                        href={`/players/${r.slug}`}
                        className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
                      >
                        <PlayerAvatar name={r.name} photoUrl={r.photoUrl} color={r.teamColor} color2={r.teamColor2} size={36} />
                        <span className="truncate text-sm font-medium">{r.name}</span>
                      </Link>
                      {r.teamName && (
                        <TeamBadge name={r.teamName} logoUrl={r.teamLogo} color={r.teamColor ?? undefined} color2={r.teamColor2} size={18} />
                      )}
                      <span className="w-6 shrink-0 text-right text-sm font-bold tnum">
                        {r.value}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </Card>
    </aside>
  );
}
