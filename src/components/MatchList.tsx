import Link from "next/link";
import { StatusPill, TeamBadge } from "@/components/ui";
import { thaiDayMonth, thaiTime } from "@/lib/format";

export type MatchListItem = {
  id: string;
  round: number;
  kickoffAt: Date;
  venue: string | null;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: { id: string; name: string; shortName: string; slug: string; logoUrl: string | null; color: string; color2: string | null };
  awayTeam: { id: string; name: string; shortName: string; slug: string; logoUrl: string | null; color: string; color2: string | null };
};

export function MatchRow({ match, showRound = false }: { match: MatchListItem; showRound?: boolean }) {
  const played = match.homeGoals !== null && match.awayGoals !== null;
  const homeWin = played && match.homeGoals! > match.awayGoals!;
  const awayWin = played && match.awayGoals! > match.homeGoals!;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex items-center gap-2 border-b border-line px-3 py-3 transition last:border-0 hover:bg-canvas sm:gap-3 sm:px-5"
    >
      <div className="w-12 shrink-0 text-[11px] leading-tight text-muted sm:w-16 sm:text-xs">
        <div>{thaiDayMonth(match.kickoffAt)}</div>
        <div className="tnum">{thaiTime(match.kickoffAt)}</div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <span className={`flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right sm:gap-2 ${homeWin ? "font-semibold" : ""}`}>
          <span className="truncate text-sm">{match.homeTeam.shortName}</span>
          <TeamBadge name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} color={match.homeTeam.color} color2={match.homeTeam.color2} size={20} />
        </span>

        <span className="w-12 shrink-0 text-center tnum sm:w-16">
          {played ? (
            <span className="rounded-md bg-canvas px-1.5 py-1 text-sm font-bold sm:px-2">
              {match.homeGoals}–{match.awayGoals}
            </span>
          ) : (
            <span className="text-xs text-muted">พบ</span>
          )}
        </span>

        <span className={`flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 ${awayWin ? "font-semibold" : ""}`}>
          <TeamBadge name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} color={match.awayTeam.color} color2={match.awayTeam.color2} size={20} />
          <span className="truncate text-sm">{match.awayTeam.shortName}</span>
        </span>
      </div>

      <div className="hidden w-28 shrink-0 items-center justify-end gap-2 md:flex">
        {showRound && <span className="text-xs text-muted">นัดที่ {match.round}</span>}
        {match.status !== "FINISHED" && <StatusPill status={match.status} />}
      </div>
    </Link>
  );
}

export function MatchList({
  matches,
  showRound = false,
  empty = "ไม่มีการแข่งขัน",
}: {
  matches: MatchListItem[];
  showRound?: boolean;
  empty?: string;
}) {
  if (matches.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted sm:px-5">{empty}</p>;
  }
  return (
    <div>
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} showRound={showRound} />
      ))}
    </div>
  );
}
