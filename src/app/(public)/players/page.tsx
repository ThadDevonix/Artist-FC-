import Link from "next/link";
import { Card, POSITION_LABEL, POSITION_SHORT, TeamBadge } from "@/components/ui";
import { getSeasonBySlug } from "@/server/queries";
import { getPlayerSeasonStats, listSeasonPlayers, listSeasonTeams } from "@/server/queries";
import { POSITIONS } from "@/lib/labels";
import { parseEnumParam, positionEnum } from "@/server/validation";

export const metadata = { title: "ผู้เล่น" };

export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const sp = await searchParams;
  const season = await getSeasonBySlug(typeof sp.season === "string" ? sp.season : undefined);
  if (!season) return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาลในระบบ</p>;

  const teamSlug = typeof sp.team === "string" ? sp.team : undefined;
  const position = parseEnumParam(positionEnum, sp.pos);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const [teams, players, stats] = await Promise.all([
    listSeasonTeams(season.id),
    listSeasonPlayers(season.id, { teamSlug, position, search: q || undefined }),
    getPlayerSeasonStats(season.id),
  ]);

  const chip = (params: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    if (teamSlug) next.set("team", teamSlug);
    if (position) next.set("pos", position);
    if (q) next.set("q", q);
    for (const [k, v] of Object.entries(params)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    return `/players${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ผู้เล่น</h1>

      <form action="/players" className="flex gap-2">
        {teamSlug && <input type="hidden" name="team" value={teamSlug} />}
        {position && <input type="hidden" name="pos" value={position} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อนักเตะ"
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-ink"
        />
        <button className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white">
          ค้นหา
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <FilterChip href={chip({ pos: undefined })} active={!position}>ทุกตำแหน่ง</FilterChip>
        {POSITIONS.map((p) => (
          <FilterChip key={p} href={chip({ pos: p })} active={position === p}>
            {POSITION_LABEL[p]}
          </FilterChip>
        ))}
      </div>

      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <FilterChip href={chip({ team: undefined })} active={!teamSlug}>ทุกทีม</FilterChip>
        {teams.map((t) => (
          <FilterChip key={t.id} href={chip({ team: t.slug })} active={teamSlug === t.slug}>
            <TeamBadge name={t.name} logoUrl={t.logoUrl} color={t.color} size={16} />
            {t.shortName}
          </FilterChip>
        ))}
      </div>

      <Card bodyClassName="overflow-x-auto">
        {players.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">ไม่พบนักเตะตามเงื่อนไข</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="w-9 py-2 pl-3 text-center font-medium sm:w-12 sm:pl-4">#</th>
                <th className="py-2 text-left font-medium">นักเตะ</th>
                <th className="hidden py-2 text-left font-medium sm:table-cell">สโมสร</th>
                <th className="w-12 py-2 text-center font-medium sm:w-16">ตำแหน่ง</th>
                <th className="w-14 py-2 text-center font-medium">ประตู</th>
                <th className="hidden w-16 py-2 text-center font-medium md:table-cell">จ่ายบอล</th>
                <th className="hidden w-14 py-2 pr-4 text-center font-medium md:table-cell">ใบเหลือง</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const s = stats.get(p.id) ?? { goals: 0, assists: 0, yellow: 0, red: 0 };
                return (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="py-2.5 pl-3 text-center tnum text-muted sm:pl-4">{p.number ?? "—"}</td>
                    <td className="min-w-0 py-2.5 pr-2">
                      <Link href={`/players/${p.slug}`} className="font-medium hover:text-brand">
                        {p.name}
                      </Link>
                      {p.nationality && <span className="ml-2 hidden text-xs text-muted lg:inline">{p.nationality}</span>}
                      {/* จอเล็กไม่มีคอลัมน์สโมสร จึงแสดงใต้ชื่อแทน */}
                      {p.team && (
                        <span className="block truncate text-xs text-muted sm:hidden">{p.team.shortName}</span>
                      )}
                    </td>
                    <td className="hidden py-2.5 sm:table-cell">
                      {p.team && (
                        <Link href={`/teams/${p.team.slug}`} className="flex items-center gap-2 text-muted hover:text-brand">
                          <TeamBadge name={p.team.name} logoUrl={p.team.logoUrl} color={p.team.color} size={20} />
                          <span className="truncate">{p.team.shortName}</span>
                        </Link>
                      )}
                    </td>
                    <td className="py-2.5 text-center text-xs text-muted">{POSITION_SHORT[p.position]}</td>
                    <td className="py-2.5 text-center tnum font-semibold">{s.goals || "—"}</td>
                    <td className="hidden py-2.5 text-center tnum md:table-cell">{s.assists || "—"}</td>
                    <td className="hidden py-2.5 pr-4 text-center tnum md:table-cell">{s.yellow || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        active ? "border-ink bg-surface font-medium" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
