import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, POSITION_LABEL, TeamBadge, teamBackground } from "@/components/ui";
import { EventIcon, eventLabel } from "@/components/events";
import { getActiveSeason, getPlayerBySlug, listPlayerEvents } from "@/server/queries";
import { ageFrom, decodeParam, minuteLabel, thaiDate } from "@/lib/format";

export default async function PlayerPage({ params }: PageProps<"/players/[slug]">) {
  const slug = decodeParam((await params).slug);
  const player = await getPlayerBySlug(slug);
  if (!player) notFound();

  const season = await getActiveSeason();

  const events = season ? await listPlayerEvents(season.id, player.id) : [];

  const goals = events.filter((e) => e.playerId === player.id && (e.type === "GOAL" || e.type === "PENALTY_GOAL")).length;
  const assists = events.filter((e) => e.assistPlayerId === player.id).length;
  const yellow = events.filter((e) => e.playerId === player.id && (e.type === "YELLOW" || e.type === "SECOND_YELLOW")).length;
  const red = events.filter((e) => e.playerId === player.id && e.type === "RED").length;

  const age = ageFrom(player.birthDate);

  return (
    <div className="space-y-6">
      <Card bodyClassName="px-4 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white sm:size-20 sm:text-2xl"
            style={{ background: teamBackground(player.team?.color, player.team?.color2) }}
          >
            {player.number ?? player.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">{player.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {player.team && (
                <Link href={`/teams/${player.team.slug}`} className="flex items-center gap-1.5 hover:text-ink">
                  <TeamBadge name={player.team.name} logoUrl={player.team.logoUrl} color={player.team.color} color2={player.team.color2} size={18} />
                  {player.team.name}
                </Link>
              )}
              <span>{POSITION_LABEL[player.position]}</span>
              {player.nationality && <span>{player.nationality}</span>}
              {age !== null && <span>อายุ {age} ปี</span>}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="ประตู" value={goals} />
        <StatBox label="จ่ายบอล" value={assists} />
        <StatBox label="ใบเหลือง" value={yellow} />
        <StatBox label="ใบแดง" value={red} />
      </div>

      <Card title="เหตุการณ์ในฤดูกาลนี้">
        {events.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">ยังไม่มีเหตุการณ์บันทึกไว้</p>
        ) : (
          <ul>
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 border-b border-line px-3 py-3 last:border-0 sm:gap-3 sm:px-5">
                <span className="w-11 shrink-0 text-xs text-muted tnum sm:w-14">
                  {minuteLabel(e.minute, e.extraMinute)}
                </span>
                <span className="shrink-0"><EventIcon type={e.type} isAssist={e.assistPlayerId === player.id} /></span>
                <span className="min-w-0 flex-1 text-sm">
                  {e.assistPlayerId === player.id ? "จ่ายบอลให้ทำประตู" : eventLabel(e.type)}
                </span>
                <Link href={`/matches/${e.match.id}`} className="shrink-0 text-right text-xs text-muted hover:text-ink">
                  <span className="block">
                    {e.match.homeTeam.shortName} {e.match.homeGoals}–{e.match.awayGoals} {e.match.awayTeam.shortName}
                  </span>
                  <span className="block">{thaiDate(e.match.kickoffAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tnum">{value}</div>
    </div>
  );
}
