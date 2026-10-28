import { StandingsTable, ZoneLegend } from "@/components/StandingsTable";
import type { GroupStanding, LiveTeamScore, StandingZone } from "@/server/queries";

/** ตารางคะแนนแยกกลุ่ม (ฤดูกาลแบบแบ่งกลุ่ม) — จอกว้างเรียง 2 คอลัมน์ */
export function GroupStandings({
  groups,
  zones,
  live,
  movement,
}: {
  groups: GroupStanding[];
  zones: StandingZone[];
  live?: Record<string, LiveTeamScore>;
  movement?: Record<string, number>;
}) {
  return (
    <div>
      <div className="grid gap-x-6 gap-y-5 xl:grid-cols-2">
        {groups.map((g) => (
          <section key={g.group}>
            <h3 className="flex items-center gap-2 px-4 pb-1 text-sm font-semibold sm:px-5">
              {g.label}
              {g.complete && <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">แข่งครบแล้ว</span>}
            </h3>
            <StandingsTable rows={g.rows} zones={zones} live={live} movement={movement} compact />
          </section>
        ))}
      </div>
      <ZoneLegend zones={zones} />
    </div>
  );
}
