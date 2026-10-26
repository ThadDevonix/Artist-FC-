import { Card } from "@/components/ui";
import { SeasonSelect } from "@/components/SeasonSelect";
import { StandingsTable, ZoneLegend } from "@/components/StandingsTable";
import { StatLeadersPanel } from "@/components/StatLeaders";
import { getSeasonBySlug, getStandings, listSeasons } from "@/server/queries";

export const metadata = { title: "ตารางคะแนน" };

export default async function StandingsPage({ searchParams }: PageProps<"/standings">) {
  const { season: seasonSlug } = await searchParams;
  const seasons = await listSeasons();
  const season = await getSeasonBySlug(
    typeof seasonSlug === "string" ? seasonSlug : undefined,
  );

  if (!season) {
    return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาลในระบบ</p>;
  }

  const { rows, zones } = await getStandings(season.id);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">ตารางคะแนน</h1>

        <Card bodyClassName="pb-1">
          <div className="px-4 pt-4 sm:px-5">
            <SeasonSelect
              seasons={seasons.map((s) => ({ slug: s.slug, name: s.name }))}
              current={season.slug}
            />
          </div>
          <div className="mt-3">
            <StandingsTable rows={rows} zones={zones} />
          </div>
          <ZoneLegend zones={zones} />
        </Card>
      </div>

      <StatLeadersPanel seasonId={season.id} />
    </div>
  );
}
