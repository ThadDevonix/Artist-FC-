import Link from "next/link";
import { FormDots, TeamBadge } from "@/components/ui";
import { signed } from "@/lib/format";
import type { StandingRow } from "@/lib/standings";
import { liveClockProps } from "@/lib/live-clock";
import { LiveClock } from "@/components/LiveClock";
import type { LiveTeamScore } from "@/server/queries";

type Zone = { label: string; color: string; fromPos: number; toPos: number };

/**
 * ตารางคะแนน — ซ่อนคอลัมน์ทีละชั้นตามความกว้างจอ เพื่อให้มือถืออ่านได้โดยไม่ต้องเลื่อนแนวนอน
 *   จอเล็ก (<640)   #  สโมสร  แข่ง  ต่าง  แต้ม
 *   sm (≥640)       + ชนะ เสมอ แพ้
 *   md (≥768)       + ได้ เสีย
 *   lg (≥1024)      + ฟอร์ม 5 นัดล่าสุด
 *
 * ตารางสด: ส่ง live (สกอร์ปัจจุบันของทีมที่กำลังแข่ง) และ movement (อันดับที่ขยับเทียบตารางทางการ)
 */
export function StandingsTable({
  rows,
  zones = [],
  compact = false,
  live,
  movement,
}: {
  rows: StandingRow[];
  zones?: Zone[];
  compact?: boolean;
  live?: Record<string, LiveTeamScore>;
  /** teamId → จำนวนอันดับที่ขยับ (บวก = ขึ้น) */
  movement?: Record<string, number>;
}) {
  const zoneFor = (pos: number) => zones.find((z) => pos >= z.fromPos && pos <= z.toPos);

  if (rows.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted">
        ยังไม่มีทีมในฤดูกาลนี้
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="w-8 py-2 pl-3 text-left font-medium sm:w-10 sm:pl-4">#</th>
            <th className="py-2 text-left font-medium">สโมสร</th>
            <th className="w-9 py-2 text-center font-medium sm:w-12">แข่ง</th>
            <th className="hidden w-9 py-2 text-center font-medium sm:table-cell sm:w-12">ชนะ</th>
            <th className="hidden w-9 py-2 text-center font-medium sm:table-cell sm:w-12">เสมอ</th>
            <th className="hidden w-9 py-2 text-center font-medium sm:table-cell sm:w-12">แพ้</th>
            <th className="hidden w-12 py-2 text-center font-medium md:table-cell">ได้</th>
            <th className="hidden w-12 py-2 text-center font-medium md:table-cell">เสีย</th>
            <th className="w-10 py-2 text-center font-medium sm:w-12">ต่าง</th>
            <th className="w-11 py-2 pr-3 text-center font-semibold text-ink sm:w-14 sm:pr-0">แต้ม</th>
            {!compact && (
              <th className="hidden w-36 py-2 pr-4 text-left font-medium lg:table-cell">
                5 นัดล่าสุด
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const zone = zoneFor(row.position);
            const playing = live?.[row.team.id];
            const moved = movement?.[row.team.id] ?? 0;
            return (
              <tr
                key={row.team.id}
                className={`border-b border-line last:border-0 ${playing ? "bg-red-50/60 dark:bg-red-950/30" : "hover:bg-canvas"}`}
              >
                <td className="relative py-2.5 pl-3 tnum text-muted sm:pl-4">
                  {zone && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                      style={{ background: zone.color }}
                      title={zone.label}
                    />
                  )}
                  <span className="inline-flex items-center gap-0.5">
                    {row.position}
                    {moved !== 0 && (
                      <span
                        className={`text-[10px] font-bold ${moved > 0 ? "text-win" : "text-loss"}`}
                        title={moved > 0 ? `ขึ้น ${moved} อันดับ` : `ลง ${-moved} อันดับ`}
                      >
                        {moved > 0 ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                </td>
                <td className="min-w-0 py-2.5 pr-2">
                  <Link
                    href={`/teams/${row.team.slug}`}
                    className="flex items-center gap-2 font-medium hover:text-brand sm:gap-2.5"
                  >
                    <TeamBadge
                      name={row.team.name}
                      logoUrl={row.team.logoUrl}
                      color={row.team.color} color2={row.team.color2}
                      size={22}
                    />
                    <span className="truncate">{row.team.shortName}</span>
                    {playing && (
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className="rounded bg-red-600 px-1.5 py-px text-[11px] font-bold text-white tnum"
                          title="สกอร์ปัจจุบัน (กำลังแข่ง)"
                        >
                          {playing.goalsFor}–{playing.goalsAgainst}
                        </span>
                        <LiveClock
                          {...liveClockProps({
                            livePeriod: playing.livePeriod,
                            liveBreak: playing.liveBreak,
                            phaseStartedAt: playing.phaseStartedAt,
                            season: { periods: playing.periods, periodMinutes: playing.periodMinutes, extraTimeMinutes: playing.extraTimeMinutes },
                          })}
                          className="text-[11px]"
                        />
                      </span>
                    )}
                  </Link>
                </td>
                <td className="py-2.5 text-center tnum">{row.played}</td>
                <td className="hidden py-2.5 text-center tnum sm:table-cell">{row.won}</td>
                <td className="hidden py-2.5 text-center tnum sm:table-cell">{row.drawn}</td>
                <td className="hidden py-2.5 text-center tnum sm:table-cell">{row.lost}</td>
                <td className="hidden py-2.5 text-center tnum md:table-cell">{row.goalsFor}</td>
                <td className="hidden py-2.5 text-center tnum md:table-cell">{row.goalsAgainst}</td>
                <td className="py-2.5 text-center tnum">{signed(row.goalDiff)}</td>
                <td className="py-2.5 pr-3 text-center tnum font-bold sm:pr-0">{row.points}</td>
                {!compact && (
                  <td className="hidden py-2.5 pr-4 lg:table-cell">
                    <FormDots form={row.form} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ZoneLegend({ zones }: { zones: Zone[] }) {
  if (zones.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3 text-xs text-muted sm:px-5">
      {zones.map((z) => (
        <li key={z.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-[3px] shrink-0 rounded-full"
            style={{ background: z.color }}
          />
          {z.label} (อันดับ {z.fromPos}
          {z.toPos !== z.fromPos ? `–${z.toPos}` : ""})
        </li>
      ))}
    </ul>
  );
}
