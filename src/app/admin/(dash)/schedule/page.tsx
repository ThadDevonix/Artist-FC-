import { BackLink, Card, StatusPill, TeamBadge } from "@/components/ui";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { FillAll } from "@/components/admin/FillAll";
import { RoundPicker } from "@/components/RoundPicker";
import { SeasonPicker } from "@/components/admin/SeasonPicker";
import { autoScheduleAction, saveScheduleAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import { getSeasonBySlug, listMatchesForAdmin, listRoundOptions, listSeasons } from "@/server/queries";
import { toThaiDate, toThaiTime } from "@/lib/format";

export const metadata = { title: "จัดวันเวลาแข่ง" };

/** วันในสัปดาห์ เรียงแบบไทย (จันทร์ก่อน) — value ตาม Date.getDay(): 0 = อาทิตย์ */
const WEEKDAYS = [
  { value: 1, label: "จ" },
  { value: 2, label: "อ" },
  { value: 3, label: "พ" },
  { value: 4, label: "พฤ" },
  { value: 5, label: "ศ" },
  { value: 6, label: "ส" },
  { value: 0, label: "อา" },
];

/**
 * จัดวัน เวลา และสนามของทุกคู่ในนัดเดียวกันจากหน้าเดียว
 * ลีกจริงแต่ละคู่ในนัดเดียวกันแข่งคนละวันได้ (จันทร์ เสาร์ อาทิตย์ …) — วันที่ได้จากตอนสร้างตารางเป็นแค่ค่าตั้งต้น
 */
export default async function SchedulePage({ searchParams }: PageProps<"/admin/schedule">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const [seasons, season] = await Promise.all([
    listSeasons(),
    getSeasonBySlug(typeof sp.season === "string" ? sp.season : undefined),
  ]);
  if (!season) return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาล</p>;

  const rounds = await listRoundOptions(season.id);
  const asked = typeof sp.round === "string" ? Number(sp.round) : undefined;
  const round = rounds.some((r) => r.round === asked) ? asked : rounds[0]?.round;
  const matches = round ? await listMatchesForAdmin(season.id, { round }) : [];
  const query = season.isActive ? "" : `season=${encodeURIComponent(season.slug)}`;
  const unset = matches.filter((m) => !m.kickoffAt).length;

  return (
    <div className="space-y-4">
      <div>
        <BackLink href={`/admin/matches${query ? `?${query}` : ""}`}>บันทึกผลการแข่งขัน</BackLink>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">จัดวันเวลาแข่ง</h1>
          <SeasonPicker
            seasons={seasons.map((s) => ({ slug: s.slug, name: s.name, isActive: s.isActive }))}
            current={season.slug}
          />
        </div>
        <p className="mt-1 text-sm text-muted">
          แต่ละคู่ในนัดเดียวกันตั้งคนละวัน/เวลาได้ แล้วกดบันทึกครั้งเดียว · ยังไม่รู้วันก็เว้นว่างไว้ได้
        </p>
      </div>

      {rounds.length === 0 ? (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีตารางแข่ง — สร้างได้ที่หน้า ฤดูกาล</p>
        </Card>
      ) : (
        <>
          <details className="rounded-xl border border-line bg-surface" open={unset === matches.length}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium sm:px-5">ตั้งวันเวลาทุกนัดอัตโนมัติ</summary>
            <ActionForm action={autoScheduleAction} className="space-y-3 px-4 pb-5 sm:px-5">
              <input type="hidden" name="seasonId" value={season.id} />
              <p className="text-sm text-muted">
                1 นัดต่อสัปดาห์ แล้วกระจายคู่ลงวันที่เลือก (แบบพรีเมียร์ลีก) — ใช้กับทุกคู่ที่ยังไม่แข่ง ทับวันเวลาเดิม
              </p>

              <Field label="วันเริ่ม" hint="นัดแรกที่ยังไม่แข่งอยู่ใน 7 วันนับจากวันนี้ นัดถัดไปเลื่อนไปทีละสัปดาห์">
                <input type="date" name="startDate" defaultValue={season.startDate ? toThaiDate(season.startDate) : ""} className={inputClass} />
              </Field>

              <fieldset>
                <legend className="mb-1 text-sm font-medium">วันที่แข่ง</legend>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => (
                    <label key={d.value} className="cursor-pointer">
                      <input type="checkbox" name="weekdays" value={d.value} className="peer sr-only" />
                      <span className="inline-flex size-10 items-center justify-center rounded-full border border-line text-sm font-medium text-muted transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                        {d.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                <Field label="เวลาเตะ" hint="ใส่ได้หลายเวลา คั่นด้วยลูกน้ำ — คู่ในวันเดียวกันไล่ใช้ตามลำดับ">
                  <input name="kickoffTimes" defaultValue="19:00, 20:30" className={inputClass} placeholder="19:00, 20:30" />
                </Field>
                <Field label="แต่ละนัดห่างกัน (สัปดาห์)">
                  <input type="number" name="weeksBetween" min={1} max={8} defaultValue={1} className={inputClass} />
                </Field>
              </div>

              <SubmitButton confirm="ตั้งวันเวลาใหม่ให้ทุกคู่ที่ยังไม่แข่ง (ทับของเดิม) ยืนยันไหม?">ตั้งวันเวลาอัตโนมัติ</SubmitButton>
            </ActionForm>
          </details>

          <RoundPicker rounds={rounds} current={round} path="/admin/schedule" query={query} />

          <Card bodyClassName="px-4 pb-5 sm:px-5" title={`นัดที่ ${round} · ${matches.length} คู่${unset ? ` · ยังไม่มีวัน ${unset} คู่` : ""}`}>
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
                            defaultValue={toThaiDate(m.kickoffAt)}
                            aria-label="วันแข่ง"
                            className={inputClass}
                          />
                          <input
                            type="time"
                            name={`time_${m.id}`}
                            data-fill="time"
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
