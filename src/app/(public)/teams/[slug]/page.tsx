import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, FormDots, POSITION_LABEL, TeamBadge, PlayerAvatar } from "@/components/ui";
import { MatchList } from "@/components/MatchList";
import {
  getActiveSeason,
  getPlayerSeasonStats,
  getStandings,
  getTeamBySlug,
  getTeamMatches,
  listTeamPlayers,
} from "@/server/queries";
import { decodeParam, signed } from "@/lib/format";

const ORDER = ["GK", "DF", "MF", "FW"] as const;

export default async function TeamPage({ params }: PageProps<"/teams/[slug]">) {
  const slug = decodeParam((await params).slug);
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const season = await getActiveSeason();
  if (!season) return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาลในระบบ</p>;

  const [{ rows }, matches, players, stats] = await Promise.all([
    getStandings(season.id),
    getTeamMatches(season.id, team.id),
    listTeamPlayers(team.id),
    getPlayerSeasonStats(season.id),
  ]);

  const row = rows.find((r) => r.team.id === team.id);
  const played = matches.filter((m) => m.status === "FINISHED");
  const upcoming = matches.filter((m) => m.status !== "FINISHED");

  const squad = ORDER.map((pos) => ({
    pos,
    list: players.filter((p) => p.position === pos),
  })).filter((g) => g.list.length > 0);

  return (
    <div className="space-y-6">
      <Card bodyClassName="px-4 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <TeamBadge name={team.name} code={team.code} logoUrl={team.logoUrl} color={team.color} color2={team.color2} size={56} />
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{team.name}</h1>
              <p className="mt-1 text-sm text-muted">
                {[team.city, team.venue, team.founded ? `ก่อตั้ง ${team.founded}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          {row && (
            <div className="flex flex-wrap items-center gap-5">
              <div>
                <div className="text-xs text-muted">อันดับ</div>
                <div className="text-2xl font-bold tnum">{row.position}</div>
              </div>
              <div>
                <div className="text-xs text-muted">แต้ม</div>
                <div className="text-2xl font-bold tnum">{row.points}</div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted">ฟอร์ม</div>
                <FormDots form={row.form} size={18} />
              </div>
            </div>
          )}
        </div>
      </Card>

      {row && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          <StatBox label="แข่ง" value={row.played} />
          <StatBox label="ชนะ" value={row.won} />
          <StatBox label="เสมอ" value={row.drawn} />
          <StatBox label="แพ้" value={row.lost} />
          <StatBox label="ได้ / เสีย" value={`${row.goalsFor}/${row.goalsAgainst}`} />
          <StatBox label="ผลต่าง" value={signed(row.goalDiff)} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="ผลการแข่งขัน">
          <MatchList matches={[...played].reverse()} showRound empty="ยังไม่มีนัดที่แข่งจบ" />
        </Card>
        <Card title="นัดถัดไป">
          <MatchList matches={upcoming} showRound empty="ไม่มีนัดที่รอแข่ง" />
        </Card>
      </div>

      <Card title={`ผู้เล่น (${players.length} คน)`}>
        {squad.map((group) => (
          <div key={group.pos}>
            <h3 className="border-b border-line bg-canvas px-4 py-2 text-xs font-semibold text-muted sm:px-5">
              {POSITION_LABEL[group.pos]}
            </h3>
            <ul>
              {group.list.map((p) => {
                const s = stats.get(p.id) ?? { goals: 0, assists: 0, yellow: 0, red: 0 };
                return (
                  <li key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0 sm:px-5">
                    <span className="w-7 shrink-0 text-center text-sm text-muted tnum">{p.number ?? "—"}</span>
                    <Link href={`/players/${p.slug}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-sm font-medium hover:underline">
                      <PlayerAvatar name={p.name} photoUrl={p.photoUrl} color={team.color} color2={team.color2} size={32} />
                      <span className="truncate">{p.name}</span>
                    </Link>
                    {p.nationality && <span className="hidden shrink-0 text-xs text-muted sm:inline">{p.nationality}</span>}
                    <span className="w-24 shrink-0 text-right text-xs text-muted tnum">
                      {s.goals} ประตู · {s.assists} จ่าย
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold tnum">{value}</div>
    </div>
  );
}
