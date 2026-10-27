import Link from "next/link";
import { Card, TeamBadge } from "@/components/ui";
import { getSeasonBySlug, getStandings } from "@/server/queries";
import { getCleanSheets, getLeaders, LEADER_LABELS, type LeaderBoard } from "@/server/queries";
import { signed } from "@/lib/format";

export const metadata = { title: "สถิติ" };

const BOARDS: LeaderBoard[] = ["goals", "assists", "yellow", "red"];

export default async function StatsPage({ searchParams }: PageProps<"/stats">) {
  const sp = await searchParams;
  const season = await getSeasonBySlug(typeof sp.season === "string" ? sp.season : undefined);
  if (!season) return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาลในระบบ</p>;

  const [boards, { rows }, cleanSheets] = await Promise.all([
    Promise.all(BOARDS.map(async (b) => ({ board: b, rows: await getLeaders(season.id, b, 10) }))),
    getStandings(season.id),
    getCleanSheets(season.id),
  ]);

  const mostGoals = [...rows].sort((a, b) => b.goalsFor - a.goalsFor).slice(0, 5);
  const bestDefence = [...rows]
    .filter((r) => r.played > 0)
    .sort((a, b) => a.goalsAgainst - b.goalsAgainst)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สถิติ</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {boards.map(({ board, rows: leaders }) => (
          <Card key={board} title={`ผู้นำ${LEADER_LABELS[board]}`}>
            {leaders.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>
            ) : (
              <ol>
                {leaders.map((r, i) => (
                  <li
                    key={r.playerId}
                    className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 sm:px-5"
                  >
                    <span className="w-5 shrink-0 text-sm text-muted tnum">{i + 1}</span>
                    <Link href={`/players/${r.slug}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.teamSlug && (
                      <Link href={`/teams/${r.teamSlug}`} className="flex shrink-0 items-center gap-1.5 text-xs text-muted hover:text-ink">
                        <TeamBadge name={r.teamName ?? ""} logoUrl={r.teamLogo} size={18} />
                        <span className="hidden sm:inline">{r.teamName}</span>
                      </Link>
                    )}
                    <span className="w-8 shrink-0 text-right text-sm font-bold tnum">{r.value}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <TeamStatCard title="ยิงประตูมากที่สุด" rows={mostGoals.map((r) => ({ team: r.team, value: r.goalsFor }))} />
        <TeamStatCard title="เสียประตูน้อยที่สุด" rows={bestDefence.map((r) => ({ team: r.team, value: r.goalsAgainst }))} />
        <TeamStatCard title="ไม่เสียประตู (clean sheet)" rows={cleanSheets.slice(0, 5)} />
      </div>

      <Card title="สถิติทุกทีม" bodyClassName="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2 pl-3 text-left font-medium sm:pl-4">สโมสร</th>
              <th className="py-2 text-center font-medium">แข่ง</th>
              <th className="py-2 text-center font-medium">ได้</th>
              <th className="py-2 text-center font-medium">เสีย</th>
              <th className="py-2 text-center font-medium">ต่าง</th>
              <th className="hidden py-2 text-center font-medium md:table-cell">เหย้า ช-ส-พ</th>
              <th className="hidden py-2 pr-4 text-center font-medium md:table-cell">เยือน ช-ส-พ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="min-w-0 py-2.5 pl-3 sm:pl-4">
                  <Link href={`/teams/${r.team.slug}`} className="flex items-center gap-2 font-medium hover:text-brand">
                    <TeamBadge name={r.team.name} logoUrl={r.team.logoUrl} color={r.team.color} color2={r.team.color2} size={22} />
                    <span className="truncate">{r.team.shortName}</span>
                  </Link>
                </td>
                <td className="py-2.5 text-center tnum">{r.played}</td>
                <td className="py-2.5 text-center tnum">{r.goalsFor}</td>
                <td className="py-2.5 text-center tnum">{r.goalsAgainst}</td>
                <td className="py-2.5 text-center tnum">{signed(r.goalDiff)}</td>
                <td className="hidden py-2.5 text-center tnum text-muted md:table-cell">
                  {r.homeRecord.won}-{r.homeRecord.drawn}-{r.homeRecord.lost}
                </td>
                <td className="hidden py-2.5 pr-4 text-center tnum text-muted md:table-cell">
                  {r.awayRecord.won}-{r.awayRecord.drawn}-{r.awayRecord.lost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function TeamStatCard({
  title,
  rows,
}: {
  title: string;
  rows: { team: { name: string; shortName: string; slug: string; logoUrl: string | null; color: string; color2: string | null }; value: number }[];
}) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">ยังไม่มีข้อมูล</p>
      ) : (
        <ol>
          {rows.map((r, i) => (
            <li key={r.team.slug} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 sm:px-5">
              <span className="w-4 shrink-0 text-sm text-muted tnum">{i + 1}</span>
              <Link href={`/teams/${r.team.slug}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium hover:underline">
                <TeamBadge name={r.team.name} logoUrl={r.team.logoUrl} color={r.team.color} color2={r.team.color2} size={20} />
                <span className="truncate">{r.team.shortName}</span>
              </Link>
              <span className="shrink-0 text-sm font-bold tnum">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
