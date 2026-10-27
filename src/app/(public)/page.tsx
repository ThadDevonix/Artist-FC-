import Link from "next/link";
import { Card, TeamBadge } from "@/components/ui";
import { MatchList } from "@/components/MatchList";
import { StandingsTable } from "@/components/StandingsTable";
import { StatLeadersPanel } from "@/components/StatLeaders";
import { getActiveSeason, getRecentAndUpcoming, getStandings, listSeasonTeams } from "@/server/queries";
import { getSeasonProgress } from "@/server/queries";

export default async function OverviewPage() {
  const season = await getActiveSeason();

  if (!season) {
    return (
      <Card>
        <p className="px-5 py-12 text-center text-muted">
          ยังไม่มีฤดูกาลในระบบ — เข้า{" "}
          <Link href="/admin" className="font-medium text-ink underline">
            หลังบ้าน
          </Link>{" "}
          เพื่อสร้างฤดูกาลแรก
        </p>
      </Card>
    );
  }

  const [{ rows, zones }, { recent, upcoming }, progress, teams] = await Promise.all([
    getStandings(season.id),
    getRecentAndUpcoming(season.id, 5),
    getSeasonProgress(season.id),
    listSeasonTeams(season.id),
  ]);

  const goals = rows.reduce((s, r) => s + r.goalsFor, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="นัดที่แข่งแล้ว" value={`${progress.playedMatches}/${progress.totalMatches}`} />
          <Stat label="นัดปัจจุบัน" value={`${progress.currentRound}/${progress.totalRounds}`} />
          <Stat label="ประตูรวม" value={goals} />
          <Stat
            label="เฉลี่ยต่อนัด"
            value={progress.playedMatches ? (goals / progress.playedMatches).toFixed(2) : "—"}
          />
        </section>

        <Card
          title="ตารางคะแนน"
          action={
            <Link href="/standings" className="text-sm text-muted hover:text-ink">
              ดูทั้งหมด
            </Link>
          }
          bodyClassName="pb-2"
        >
          <StandingsTable rows={rows.slice(0, 6)} zones={zones} compact />
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card
            title="ผลล่าสุด"
            action={
              <Link href="/fixtures?filter=results" className="text-sm text-muted hover:text-ink">
                ทั้งหมด
              </Link>
            }
          >
            <MatchList matches={recent} showRound empty="ยังไม่มีนัดที่แข่งจบ" />
          </Card>

          <Card
            title="นัดถัดไป"
            action={
              <Link href="/fixtures?filter=upcoming" className="text-sm text-muted hover:text-ink">
                ทั้งหมด
              </Link>
            }
          >
            <MatchList matches={upcoming} showRound empty="ไม่มีนัดที่รอแข่ง" />
          </Card>
        </div>

        <Card title="ทีม" bodyClassName="px-4 pb-5 sm:px-5">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {teams.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/teams/${t.slug}`}
                  className="flex h-full flex-col items-center gap-2 rounded-xl border border-line p-3 text-center transition hover:bg-canvas"
                >
                  <TeamBadge name={t.name} code={t.code} logoUrl={t.logoUrl} color={t.color} color2={t.color2} size={44} />
                  <span className="text-xs font-medium leading-snug">{t.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <StatLeadersPanel seasonId={season.id} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-bold tnum">{value}</div>
    </div>
  );
}
