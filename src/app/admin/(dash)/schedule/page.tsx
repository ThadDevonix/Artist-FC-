import { BackLink, Card, StatusPill, TeamBadge } from "@/components/ui";
import { ActionForm, SubmitButton, inputClass } from "@/components/admin/Form";
import { FillAll } from "@/components/admin/FillAll";
import { RoundPicker } from "@/components/RoundPicker";
import { saveScheduleAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import { getSeasonBySlug, listMatchesForAdmin, listRoundOptions } from "@/server/queries";
import { toThaiDate, toThaiTime } from "@/lib/format";

export const metadata = { title: "จัดวันเวลาแข่ง" };

/**
 * จัดวัน เวลา และสนามของทุกคู่ในนัดเดียวกันจากหน้าเดียว
 * ลีกจริงแต่ละคู่ในนัดเดียวกันแข่งคนละวันได้ (จันทร์ เสาร์ อาทิตย์ …) — วันที่ได้จากตอนสร้างตารางเป็นแค่ค่าตั้งต้น
 */
export default async function SchedulePage({ searchParams }: PageProps<"/admin/schedule">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const season = await getSeasonBySlug(typeof sp.season === "string" ? sp.season : undefined);
  if (!season) return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาล</p>;

  const rounds = await listRoundOptions(season.id);
  const asked = typeof sp.round === "string" ? Number(sp.round) : undefined;
  const round = rounds.some((r) => r.round === asked) ? asked : rounds[0]?.round;
  const matches = round ? await listMatchesForAdmin(season.id, { round }) : [];
  const query = typeof sp.season === "string" ? `season=${encodeURIComponent(sp.season)}` : "";

  return (
    <div className="space-y-4">
      <div>
        <BackLink href="/admin/matches">บันทึกผลการแข่งขัน</BackLink>
      </div>
      <div>
        <h1 className="text-2xl font-bold">จัดวันเวลาแข่ง</h1>
        <p className="mt-1 text-sm text-muted">
          ฤดูกาล {season.name} · แต่ละคู่ในนัดเดียวกันตั้งคนละวัน/เวลาได้ แล้วกดบันทึกครั้งเดียว
        </p>
      </div>

      {rounds.length === 0 ? (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีตารางแข่ง — สร้างได้ที่หน้า ฤดูกาล</p>
        </Card>
      ) : (
        <>
          <RoundPicker rounds={rounds} current={round} path="/admin/schedule" query={query} />

          <Card bodyClassName="px-4 pb-5 sm:px-5" title={`นัดที่ ${round} · ${matches.length} คู่`}>
            <ActionForm action={saveScheduleAction} className="space-y-4" key={round}>
              <FillAll />

              <ul className="divide-y divide-line">
                {matches.map((m) => {
                  const live = m.status === "LIVE";
                  return (
                    <li key={m.id} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <input type="hidden" name="matchId" value={m.id} />
                      <div className="flex min-w-0 items-center gap-2 text-sm">
                        <TeamBadge name={m.homeTeam.name} logoUrl={m.homeTeam.logoUrl} color={m.homeTeam.color} color2={m.homeTeam.color2} size={22} />
                        <span className="truncate font-medium">{m.homeTeam.shortName}</span>
                        <span className="text-muted">พบ</span>
                        <TeamBadge name={m.awayTeam.name} logoUrl={m.awayTeam.logoUrl} color={m.awayTeam.color} color2={m.awayTeam.color2} size={22} />
                        <span className="truncate font-medium">{m.awayTeam.shortName}</span>
                        {m.status !== "SCHEDULED" && <StatusPill status={m.status} />}
                      </div>
                      {live ? (
                        <p className="text-sm text-muted">กำลังถ่ายทอดสด — แก้วันเวลาไม่ได้</p>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[10rem_7rem_minmax(0,14rem)]">
                          <input
                            type="date"
                            name={`date_${m.id}`}
                            data-fill="date"
                            required
                            defaultValue={toThaiDate(m.kickoffAt)}
                            aria-label="วันแข่ง"
                            className={inputClass}
                          />
                          <input
                            type="time"
                            name={`time_${m.id}`}
                            data-fill="time"
                            required
                            defaultValue={toThaiTime(m.kickoffAt)}
                            aria-label="เวลาเตะ"
                            className={inputClass}
                          />
                          <input
                            name={`venue_${m.id}`}
                            defaultValue={m.venue ?? ""}
                            placeholder="สนาม"
                            aria-label="สนาม"
                            className={`${inputClass} col-span-2 sm:col-span-1`}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <SubmitButton className="w-full sm:w-auto">บันทึกวันเวลานัดที่ {round}</SubmitButton>
            </ActionForm>
          </Card>
        </>
      )}
    </div>
  );
}
