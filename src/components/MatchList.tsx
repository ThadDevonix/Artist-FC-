import Link from "next/link";
import { StatusPill, TeamBadge } from "@/components/ui";
import { thaiDayMonth, thaiTime } from "@/lib/format";
import { liveClockProps } from "@/lib/live-clock";
import { LiveClock } from "@/components/LiveClock";

export type MatchListItem = {
  id: string;
  round: number;
  kickoffAt: Date | null;
  venue: string | null;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: { id: string; name: string; shortName: string; slug: string; logoUrl: string | null; color: string; color2: string | null };
  awayTeam: { id: string; name: string; shortName: string; slug: string; logoUrl: string | null; color: string; color2: string | null };
  /** นาฬิกาถ่ายทอดสด (มีเมื่อดึงด้วย matchListSelect) */
  livePeriod?: number | null;
  liveBreak?: boolean;
  phaseStartedAt?: Date | null;
  season?: { periods: number; periodMinutes: number };
};

export function MatchRow({ match, showRound = false }: { match: MatchListItem; showRound?: boolean }) {
  const played = match.homeGoals !== null && match.awayGoals !== null;
  const live = match.status === "LIVE";
  const homeWin = played && match.homeGoals! > match.awayGoals!;
  const awayWin = played && match.awayGoals! > match.homeGoals!;

  const clock = live && match.season && (
    <LiveClock {...liveClockProps({ livePeriod: match.livePeriod ?? null, liveBreak: match.liveBreak ?? false, phaseStartedAt: match.phaseStartedAt ?? null, season: match.season })} />
  );
  // สถานะที่ควรเห็นในกล่องแคบ — "ยังไม่แข่ง" / "จบแล้ว" เป็นค่าปกติ ไม่ต้องโชว์ให้รก
  const notable = match.status !== "SCHEDULED" && match.status !== "FINISHED";

  // จัดตามความกว้างของกล่องรายการ (@container) ไม่ใช่ความกว้างจอ — การ์ด "นัดถัดไป" แคบแม้บนจอใหญ่
  // กล่องแคบ: วันเวลา/สถานะอยู่บรรทัดบน ทีมเต็มบรรทัดล่าง จัดกึ่งกลางทั้งคู่ให้ตรงกับสกอร์ · กล่องกว้าง: แถวเดียว วันเวลา | ทีม | สถานะ
  return (
    <Link
      href={`/matches/${match.id}`}
      className="flex flex-col gap-2 border-b border-line px-4 py-3 transition last:border-0 hover:bg-canvas sm:px-5 @lg:flex-row @lg:items-center @lg:gap-3"
    >
      <div className="flex items-center justify-center gap-2 text-xs text-muted @lg:hidden">
        <span className="truncate">
          {thaiDayMonth(match.kickoffAt)}
          {match.kickoffAt && !live && <span className="tnum"> · {thaiTime(match.kickoffAt)}</span>}
          {showRound && <span> · นัดที่ {match.round}</span>}
        </span>
        {notable && (
          <span className="flex shrink-0 items-center gap-1.5">
            <StatusPill status={match.status} />
            {clock}
          </span>
        )}
      </div>

      <div className="hidden w-20 shrink-0 text-xs leading-tight text-muted @lg:block">
        <div>{thaiDayMonth(match.kickoffAt)}</div>
        {clock || (match.kickoffAt && <div className="tnum">{thaiTime(match.kickoffAt)}</div>)}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={`flex min-w-0 flex-1 items-center justify-end gap-2 text-right ${homeWin ? "font-semibold" : ""}`}>
          <span className="truncate text-sm">{match.homeTeam.shortName}</span>
          <TeamBadge name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} color={match.homeTeam.color} color2={match.homeTeam.color2} size={20} />
        </span>

        <span className="flex w-14 shrink-0 items-center justify-center tnum">
          {played ? (
            <span className={`rounded-md px-2 py-1 text-sm font-bold ${live ? "bg-red-600 text-white" : "bg-canvas"}`}>
              {match.homeGoals}–{match.awayGoals}
            </span>
          ) : (
            <span className="text-xs leading-none text-muted">พบ</span>
          )}
        </span>

        <span className={`flex min-w-0 flex-1 items-center gap-2 ${awayWin ? "font-semibold" : ""}`}>
          <TeamBadge name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} color={match.awayTeam.color} color2={match.awayTeam.color2} size={20} />
          <span className="truncate text-sm">{match.awayTeam.shortName}</span>
        </span>
      </div>

      <div className="hidden w-28 shrink-0 items-center justify-end gap-2 @lg:flex">
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
    <div className="@container">
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} showRound={showRound} />
      ))}
    </div>
  );
}
