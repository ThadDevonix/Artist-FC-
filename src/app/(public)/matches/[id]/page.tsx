import Link from "next/link";
import { LiveClock } from "@/components/LiveClock";
import { liveClockProps } from "@/lib/live-clock";
import { notFound } from "next/navigation";
import { Card, StatusPill, TeamBadge } from "@/components/ui";
import { EventIcon, eventLabel } from "@/components/events";
import { decodeParam, minuteLabel, thaiDateTime } from "@/lib/format";
import { getMatchDetail } from "@/server/queries";

export default async function MatchPage({ params }: PageProps<"/matches/[id]">) {
  const id = decodeParam((await params).id);

  const match = await getMatchDetail(id);
  if (!match) notFound();

  const officials = [
    { label: "ผู้ตัดสิน", person: match.referee },
    { label: "ผู้ช่วยผู้ตัดสินที่ 1", person: match.assistant1 },
    { label: "ผู้ช่วยผู้ตัดสินที่ 2", person: match.assistant2 },
    { label: "ผู้ตัดสินที่ 4", person: match.fourthOfficial },
  ].flatMap((o) => (o.person ? [{ label: o.label, name: o.person.name }] : []));
  const played = match.homeGoals !== null && match.awayGoals !== null;
  const countEvents = (teamId: string, types: string[]) =>
    match.events.filter((e) => e.teamId === teamId && types.includes(e.type)).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        <Link href="/fixtures" className="hover:text-ink">การแข่งขัน</Link>
        {" · "}ฤดูกาล {match.season.name} · นัดที่ {match.round}
      </p>

      <Card bodyClassName="px-4 pb-6 sm:px-6">
        <div className="pt-6">
          <div className="flex items-start justify-center gap-2 sm:items-center sm:gap-10">
            <TeamSide team={match.homeTeam} align="right" />

            <div className="shrink-0 text-center">
              {played ? (
                <div className="text-3xl font-bold tnum sm:text-4xl">
                  {match.homeGoals}–{match.awayGoals}
                </div>
              ) : (
                <div className="text-2xl font-semibold text-muted">พบ</div>
              )}
              <div className="mt-2 flex items-center justify-center gap-2">
                <StatusPill status={match.status} />
                {match.status === "LIVE" && <LiveClock {...liveClockProps(match)} className="text-sm" />}
              </div>
            </div>

            <TeamSide team={match.awayTeam} align="left" />
          </div>

          <p className="mt-5 text-center text-sm text-muted">
            {thaiDateTime(match.kickoffAt)}
            {match.venue ? ` · ${match.venue}` : ""}
          </p>
          {match.status === "PENDING" && (
            <p className="mt-2 text-center text-sm text-amber-700 dark:text-amber-300">
              ผลนี้ส่งโดยกรรมการแล้ว รอผู้ดูแลอนุมัติ — ยังไม่ถูกนับในตารางคะแนน
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
        <Card title="เหตุการณ์ในเกม">
          {match.events.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">ยังไม่มีเหตุการณ์บันทึกไว้</p>
          ) : (
            <ul>
              {match.events.map((e) => {
                const isHome = e.teamId === match.homeTeamId;
                return (
                  <li key={e.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line px-3 py-2.5 last:border-0 sm:gap-3 sm:px-5">
                    <div className={isHome ? "text-right" : ""}>
                      {isHome && <EventDetail event={e} />}
                    </div>
                    <span className="shrink-0 rounded-md bg-canvas px-1.5 py-0.5 text-[11px] text-muted tnum sm:px-2 sm:text-xs">
                      {minuteLabel(e.minute, e.extraMinute)}
                    </span>
                    <div>{!isHome && <EventDetail event={e} />}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="สรุป">
            <dl className="divide-y divide-line">
              <SummaryRow
                label="ประตู"
                home={countEvents(match.homeTeamId, ["GOAL", "PENALTY_GOAL"])}
                away={countEvents(match.awayTeamId, ["GOAL", "PENALTY_GOAL"])}
              />
              <SummaryRow
                label="ใบเหลือง"
                home={countEvents(match.homeTeamId, ["YELLOW", "SECOND_YELLOW"])}
                away={countEvents(match.awayTeamId, ["YELLOW", "SECOND_YELLOW"])}
              />
              <SummaryRow
                label="ใบแดง"
                home={countEvents(match.homeTeamId, ["RED"])}
                away={countEvents(match.awayTeamId, ["RED"])}
              />
            </dl>
          </Card>

          {officials.length > 0 && (
            <Card title="ทีมผู้ตัดสิน">
              <dl className="divide-y divide-line text-sm">
                {officials.map((o) => (
                  <div key={o.label} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                    <dt className="text-muted">{o.label}</dt>
                    <dd className="text-right font-medium">{o.name}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamSide({
  team,
  align,
}: {
  team: { name: string; shortName: string; slug: string; logoUrl: string | null; color: string; color2: string | null; code: string };
  align: "left" | "right";
}) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center transition hover:text-brand sm:flex-row sm:gap-3 ${
        align === "right" ? "sm:flex-row-reverse sm:text-right" : "sm:text-left"
      }`}
    >
      <TeamBadge name={team.name} code={team.code} logoUrl={team.logoUrl} color={team.color} color2={team.color2} size={44} />
      <span className="line-clamp-2 text-xs font-semibold sm:truncate sm:text-base">{team.name}</span>
    </Link>
  );
}

function EventDetail({
  event,
}: {
  event: {
    type: string;
    player: { name: string; slug: string } | null;
    assistPlayer: { name: string; slug: string } | null;
    issuedBy: { name: string } | null;
  };
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <EventIcon type={event.type} />
      <span className="min-w-0">
        {event.player ? (
          <Link href={`/players/${event.player.slug}`} className="font-medium hover:underline">
            {event.player.name}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        )}
        <span className="block text-xs text-muted">
          {eventLabel(event.type)}
          {event.assistPlayer ? ` · จ่ายโดย ${event.assistPlayer.name}` : ""}
          {event.issuedBy ? ` · ให้โดย ${event.issuedBy.name}` : ""}
        </span>
      </span>
    </div>
  );
}

function SummaryRow({ label, home, away }: { label: string; home: number; away: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm sm:px-5">
      <span className="w-8 text-left font-semibold tnum">{home}</span>
      <dt className="text-muted">{label}</dt>
      <dd className="w-8 text-right font-semibold tnum">{away}</dd>
    </div>
  );
}
