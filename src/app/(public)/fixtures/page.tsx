import Link from "next/link";
import { RoundPicker } from "@/components/RoundPicker";
import { Card } from "@/components/ui";
import { MatchList } from "@/components/MatchList";
import { getSeasonBySlug, listMatchesForFixtures, listRoundOptions } from "@/server/queries";
import type { MatchStatus } from "@/generated/prisma/enums";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "การแข่งขัน" };

export default async function FixturesPage({ searchParams }: PageProps<"/fixtures">) {
  const sp = await searchParams;
  const seasonSlug = typeof sp.season === "string" ? sp.season : undefined;
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const roundParam = typeof sp.round === "string" ? Number(sp.round) : undefined;

  const season = await getSeasonBySlug(seasonSlug);
  if (!season) {
    return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาลในระบบ</p>;
  }

  const rounds = await listRoundOptions(season.id);
  const round = roundParam && rounds.some((r) => r.round === roundParam) ? roundParam : undefined;

  const matches = await listMatchesForFixtures(season.id, {
    round,
    ...(filter === "results"
      ? { status: "FINISHED" as MatchStatus, newestFirst: true }
      : filter === "upcoming"
        ? { upcoming: true }
        : {}),
  });

  // จัดกลุ่มตามนัดที่ เมื่อดูแบบรวมทุกนัด
  const grouped = new Map<number, typeof matches>();
  for (const m of matches) {
    grouped.set(m.round, [...(grouped.get(m.round) ?? []), m]);
  }

  const link = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (seasonSlug) q.set("season", seasonSlug);
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    const s = q.toString();
    return `/fixtures${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">การแข่งขัน</h1>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: "ทั้งหมด" },
          { key: "results", label: "ผลการแข่งขัน" },
          { key: "upcoming", label: "นัดที่กำลังจะมาถึง" },
        ].map((f) => (
          <Link
            key={f.key}
            href={link({ filter: f.key === "all" ? undefined : f.key, round: round ? String(round) : undefined })}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              filter === f.key
                ? "border-ink bg-surface"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <RoundPicker
        rounds={rounds}
        current={round}
        path="/fixtures"
        query={link({ filter: filter === "all" ? undefined : filter }).split("?")[1] ?? ""}
      />

      {matches.length === 0 ? (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-muted">ไม่มีการแข่งขันตามเงื่อนไขที่เลือก</p>
        </Card>
      ) : filter === "results" || round ? (
        <Card>
          <MatchList matches={matches} showRound={!round} />
        </Card>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([r, list]) => (
            <Card
              key={r}
              title={rounds.find((x) => x.round === r)?.label ?? `นัดที่ ${r}`}
              action={
                <span className="text-sm text-muted">{thaiDate(list[0].kickoffAt)}</span>
              }
            >
              <MatchList matches={list} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
