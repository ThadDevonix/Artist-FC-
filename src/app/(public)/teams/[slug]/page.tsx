import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, FormDots, POSITION_LABEL, TeamBadge, PlayerAvatar } from "@/components/ui";
import { STAFF_GROUPS, staffRoleName } from "@/lib/labels";
import { MatchList } from "@/components/MatchList";
import {
  getActiveSeason,
  getPlayerSeasonStats,
  getStandings,
  getTeamBySlug,
  getTeamMatches,
  listTeamPlayers,
  listTeamStaff,
} from "@/server/queries";
import { ageFrom, decodeParam, signed } from "@/lib/format";

const ORDER = ["GK", "DF", "MF", "FW"] as const;

const TABS = [
  { key: "all", label: "ทีมทั้งหมด" },
  ...ORDER.map((pos) => ({ key: pos, label: POSITION_LABEL[pos] })),
  { key: "staff", label: "ทีมงาน" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function TeamPage({ params, searchParams }: PageProps<"/teams/[slug]">) {
  const slug = decodeParam((await params).slug);
  const pos = (await searchParams).pos;
  const tab: Tab = TABS.find((t) => t.key === pos)?.key ?? "all";
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const season = await getActiveSeason();
  if (!season) return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาลในระบบ</p>;

  const [{ rows }, matches, players, stats, staff] = await Promise.all([
    getStandings(season.id),
    getTeamMatches(season.id, team.id),
    listTeamPlayers(team.id),
    getPlayerSeasonStats(season.id),
    listTeamStaff(team.id),
  ]);

  const row = rows.find((r) => r.team.id === team.id);
  const played = matches.filter((m) => m.status === "FINISHED");
  const upcoming = matches.filter((m) => m.status !== "FINISHED");

  const showPlayers = tab !== "staff";
  const showStaff = tab === "all" || tab === "staff";
  const squad = ORDER.filter((p) => tab === "all" || tab === p)
    .map((p) => ({ pos: p, list: players.filter((pl) => pl.position === p) }))
    .filter((g) => g.list.length > 0);
  const staffGroups = STAFF_GROUPS.map((g) => ({
    label: g.label,
    list: staff.filter((m) => g.roles.includes(m.role)),
  })).filter((g) => g.list.length > 0);
  const headCoach = staff.find((m) => m.role === "HEAD_COACH");

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
              {headCoach && (
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <PlayerAvatar name={headCoach.name} photoUrl={headCoach.photoUrl} color={team.color} color2={team.color2} size={24} />
                  <span className="text-muted">หัวหน้าผู้ฝึกสอน</span>
                  <span className="font-medium">{headCoach.name}</span>
                </p>
              )}
            </div>
          </div>
          {row && (
            <div className="flex flex-wrap items-start gap-5">
              <div>
                <div className="text-xs text-muted">อันดับ</div>
                <div className="flex h-8 items-center text-2xl font-bold tnum">{row.position}</div>
              </div>
              <div>
                <div className="text-xs text-muted">แต้ม</div>
                <div className="flex h-8 items-center text-2xl font-bold tnum">{row.points}</div>
              </div>
              <div>
                <div className="text-center text-xs text-muted">ฟอร์ม</div>
                <div className="flex h-8 items-center">
                  <FormDots form={row.form} size={18} />
                </div>
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

      <Card
        title={
          <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 text-sm">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "all" ? `/teams/${team.slug}` : `/teams/${team.slug}?pos=${t.key}`}
                scroll={false}
                className={`shrink-0 border-b-2 px-3 py-2 font-medium transition ${
                  tab === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        }
      >
        {showPlayers &&
          squad.map((group) => (
            <section key={group.pos}>
              <h3 className="flex justify-between border-y border-line bg-canvas px-4 py-2 text-xs font-semibold text-muted sm:px-5">
                <span>{POSITION_LABEL[group.pos]}</span>
                <span className="flex gap-4">
                  <span className="w-10 text-center">อายุ</span>
                  <span className="w-10 text-center">ประตู</span>
                </span>
              </h3>
              <ul>
                {group.list.map((p) => {
                  const s = stats.get(p.id);
                  const age = ageFrom(p.birthDate);
                  return (
                    <li key={p.id} className="border-b border-line last:border-0">
                      <Link href={`/players/${p.slug}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas sm:px-5">
                        <PlayerAvatar name={p.name} photoUrl={p.photoUrl} color={team.color} color2={team.color2} label={p.number} size={48} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {p.name}
                            {p.number !== null && <span className="ml-1 font-normal text-muted tnum">#{p.number}</span>}
                          </span>
                          {p.nationality && <span className="block truncate text-sm text-muted">{p.nationality}</span>}
                        </span>
                        <span className="flex shrink-0 gap-4 text-sm tnum">
                          <span className="w-10 text-center">{age ?? "—"}</span>
                          <span className="w-10 text-center font-semibold">{s?.goals || "—"}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

        {showStaff &&
          staffGroups.map((group) => (
            <section key={group.label}>
              <h3 className="border-y border-line bg-canvas px-4 py-2 text-xs font-semibold text-muted sm:px-5">
                {group.label}
              </h3>
              <ul>
                {group.list.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 sm:px-5">
                    <PlayerAvatar name={m.name} photoUrl={m.photoUrl} color={team.color} color2={team.color2} size={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{m.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {[staffRoleName(m), m.nationality].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

        {(showPlayers ? squad.length : 0) + (showStaff ? staffGroups.length : 0) === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted">
            {tab === "staff" ? "ยังไม่มีข้อมูลทีมงาน" : "ยังไม่มีผู้เล่นในตำแหน่งนี้"}
          </p>
        )}
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
