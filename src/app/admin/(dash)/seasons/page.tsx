import Link from "next/link";
import { Card, TeamBadge } from "@/components/ui";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { TypeToConfirm } from "@/components/admin/TypeToConfirm";
import { FixtureFormat } from "@/components/admin/FixtureFormat";
import { Modal } from "@/components/admin/Modal";
import { SeasonPicker } from "@/components/admin/SeasonPicker";
import { ExcelButton, exportHref } from "@/components/admin/ExcelButton";
import { StandingsTable } from "@/components/StandingsTable";
import {
  activateSeasonAction,
  assignSlotAction,
  deleteSeasonAction,
  generateFixturesAction,
  saveSeasonAction,
  saveZoneAction,
  toggleSeasonTeamAction,
} from "@/server/actions";
import { requireRole } from "@/server/auth";
import {
  getSeasonBySlug,
  getSeasonMatchCounts,
  getStandings,
  listAllTeams,
  listSeasons,
  listSeasonSlots,
  listSeasonZones,
} from "@/server/queries";
import { MAX_TEAMS } from "@/server/validation";
import { parseTiebreakers, TIEBREAKER_LABELS, type Tiebreaker } from "@/lib/standings";
import { PERIOD_OPTIONS } from "@/lib/live-clock";

export const metadata = { title: "ฤดูกาล" };

const ALL_TIEBREAKERS = Object.keys(TIEBREAKER_LABELS) as Tiebreaker[];

const outlineButton =
  "inline-flex shrink-0 items-center gap-2 rounded-lg border-2 border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white";

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 00-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default async function SeasonsPage({ searchParams }: PageProps<"/admin/seasons">) {
  await requireRole("ADMIN");
  const sp = await searchParams;

  const seasons = await listSeasons();
  const season = await getSeasonBySlug(typeof sp.season === "string" ? sp.season : undefined);

  if (!season) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">สร้างฤดูกาลแรก</h1>
        <Card bodyClassName="px-4 pb-5 sm:px-5">
          <NewSeasonForm />
        </Card>
      </div>
    );
  }

  const [allTeams, slots, zones, counts, standings] = await Promise.all([
    listAllTeams(),
    listSeasonSlots(season.id),
    listSeasonZones(season.id),
    getSeasonMatchCounts(season.id),
    getStandings(season.id),
  ]);
  const { total: matchCount, locked: lockedCount } = counts;

  const current = parseTiebreakers(season.tiebreakers);
  const inSeason = new Set(slots.map((s) => s.teamId));
  const otherClubs = allTeams.filter((t) => !inSeason.has(t.id));
  const emptySlots = slots.filter((s) => s.team.isPlaceholder).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">ฤดูกาล</h1>
        <SeasonPicker
          seasons={seasons.map((s) => ({ slug: s.slug, name: s.name, isActive: s.isActive }))}
          current={season.slug}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* ฤดูกาลที่ใช้งานอยู่ = ฤดูกาลที่หน้าเว็บแสดง — ให้เห็นและสลับได้ทันทีโดยไม่ต้องเปิดป๊อปอัพ */}
        {season.isActive ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-win/10 px-3 py-2 text-sm font-semibold text-win">
            ● ใช้งานอยู่บนหน้าเว็บ
          </span>
        ) : (
          <form action={activateSeasonAction}>
            <input type="hidden" name="id" value={season.id} />
            <SubmitButton>ใช้ฤดูกาลนี้</SubmitButton>
          </form>
        )}
        {/* key = ฤดูกาล: สลับฤดูกาลแล้วฟอร์มต้องโหลดค่าของฤดูกาลใหม่ ไม่ค้างค่าเดิม */}
        <Modal
          key={season.id}
          title={`ตั้งค่าฤดูกาล ${season.name}`}
          triggerClassName={outlineButton}
          trigger={<><EditIcon />แก้ไขการตั้งค่า {season.name}</>}
        >
          <ActionForm action={saveSeasonAction} className="space-y-4">
            <input type="hidden" name="id" value={season.id} />

            <Field label="ชื่อฤดูกาล">
              <input name="name" defaultValue={season.name} required className={inputClass} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="วันเริ่มฤดูกาล">
                <input type="date" name="startDate" defaultValue={season.startDate?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
              </Field>
              <Field label="วันจบฤดูกาล">
                <input type="date" name="endDate" defaultValue={season.endDate?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
              </Field>
            </div>

            <Field label="รูปแบบการแข่ง">
              <select name="rounds" defaultValue={season.rounds} className={inputClass}>
                <option value={1}>เจอกันทีมละครั้ง (พบกันหมดรอบเดียว)</option>
                <option value={2}>เหย้า–เยือน (พบกันหมดสองรอบ)</option>
              </select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="แต้มชนะ">
                <input type="number" name="pointsWin" defaultValue={season.pointsWin} className={inputClass} />
              </Field>
              <Field label="แต้มเสมอ">
                <input type="number" name="pointsDraw" defaultValue={season.pointsDraw} className={inputClass} />
              </Field>
              <Field label="แต้มแพ้">
                <input type="number" name="pointsLoss" defaultValue={season.pointsLoss} className={inputClass} />
              </Field>
            </div>

            <MatchTimeFields periods={season.periods} periodMinutes={season.periodMinutes} />

            <fieldset>
              <legend className="mb-1 text-sm font-medium">ลำดับการตัดสินเมื่อคะแนนเท่ากัน</legend>
              <p className="mb-2 text-xs text-muted">
                ติ๊กข้อที่ต้องการใช้ ระบบจะไล่ตามลำดับจากบนลงล่าง
              </p>
              <div className="space-y-1.5">
                {ALL_TIEBREAKERS.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="tiebreakers"
                      value={t}
                      defaultChecked={current.includes(t)}
                      className="size-4"
                    />
                    {TIEBREAKER_LABELS[t]}
                  </label>
                ))}
              </div>
            </fieldset>

            <SubmitButton>บันทึกการตั้งค่า</SubmitButton>
          </ActionForm>

          {/* ลบฤดูกาล — ต้องพิมพ์ชื่อฤดูกาลยืนยันทุกครั้ง */}
          <details className="mt-4 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm font-medium text-loss">ลบฤดูกาลนี้…</summary>
            <ActionForm action={deleteSeasonAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={season.id} />
              <p className="text-sm text-muted">
                จะลบนัดทั้งหมด {matchCount} นัด ผลแข่ง เหตุการณ์ และโซนสีของฤดูกาล &quot;{season.name}&quot; ·
                ทีมและนักเตะไม่ถูกลบ
                {season.isActive && " · ฤดูกาลนี้แสดงบนหน้าเว็บอยู่ ลบแล้วหน้าเว็บจะแสดงฤดูกาลล่าสุดที่เหลือแทน"}
              </p>
              {lockedCount > 0 && (
                <p className="text-sm font-medium text-loss">⚠ มีผลแข่งแล้ว {lockedCount} นัด จะหายทั้งหมด ย้อนกลับไม่ได้</p>
              )}
              <TypeToConfirm expected={season.name} label="ลบฤดูกาลถาวร" />
            </ActionForm>
          </details>
        </Modal>
        <Modal title="สร้างฤดูกาลใหม่" triggerClassName={outlineButton} trigger={<><PlusIcon />สร้างฤดูกาลใหม่</>}>
          <NewSeasonForm />
        </Modal>
        <ExcelButton href={exportHref("all", { season: season.slug })}>โหลด Excel ทั้งฤดูกาล</ExcelButton>
      </div>

      <Card
        title={<h2 className="shrink-0 whitespace-nowrap text-lg font-semibold">ตารางคะแนน</h2>}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Modal title="โซนสีในตารางคะแนน" triggerClassName={outlineButton} trigger="โซนสี">
              <p className="mb-3 text-sm text-muted">
                แถบสีด้านซ้ายของตารางคะแนน เช่น โซนเข้ารอบชิง หรือโซนตกชั้น
              </p>

              <div className="space-y-2">
                {zones.map((z) => (
                  <form key={z.id} action={saveZoneAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
                    <input type="hidden" name="id" value={z.id} />
                    <input type="hidden" name="seasonId" value={season.id} />
                    <label className="flex-1 min-w-[160px]">
                      <span className="mb-1 block text-xs text-muted">ชื่อโซน</span>
                      <input name="label" defaultValue={z.label} className={inputClass} />
                    </label>
                    <label className="w-20">
                      <span className="mb-1 block text-xs text-muted">ตั้งแต่</span>
                      <input type="number" name="fromPos" min={1} defaultValue={z.fromPos} className={inputClass} />
                    </label>
                    <label className="w-20">
                      <span className="mb-1 block text-xs text-muted">ถึง</span>
                      <input type="number" name="toPos" min={1} defaultValue={z.toPos} className={inputClass} />
                    </label>
                    <label className="w-16">
                      <span className="mb-1 block text-xs text-muted">สี</span>
                      <input type="color" name="color" defaultValue={z.color} className="h-9 w-full rounded-lg border border-line" />
                    </label>
                    <SubmitButton variant="ghost">บันทึก</SubmitButton>
                    <button name="_delete" value="1" className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:border-loss hover:text-loss">
                      ลบ
                    </button>
                  </form>
                ))}

                <form action={saveZoneAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-line p-3">
                  <input type="hidden" name="seasonId" value={season.id} />
                  <label className="flex-1 min-w-[160px]">
                    <span className="mb-1 block text-xs text-muted">ชื่อโซนใหม่</span>
                    <input name="label" placeholder="เช่น ตกชั้น" className={inputClass} />
                  </label>
                  <label className="w-20">
                    <span className="mb-1 block text-xs text-muted">ตั้งแต่</span>
                    <input type="number" name="fromPos" min={1} defaultValue={1} className={inputClass} />
                  </label>
                  <label className="w-20">
                    <span className="mb-1 block text-xs text-muted">ถึง</span>
                    <input type="number" name="toPos" min={1} defaultValue={1} className={inputClass} />
                  </label>
                  <label className="w-16">
                    <span className="mb-1 block text-xs text-muted">สี</span>
                    <input type="color" name="color" defaultValue="#1d4ed8" className="h-9 w-full rounded-lg border border-line" />
                  </label>
                  <SubmitButton>เพิ่มโซน</SubmitButton>
                </form>
              </div>
            </Modal>
            <ExcelButton href={exportHref("standings", { season: season.slug })}>โหลด Excel ตารางคะแนน</ExcelButton>
          </div>
        }
      >
        <StandingsTable rows={standings.rows} zones={zones} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title={`ทีมในฤดูกาล (${slots.length})`}
            action={emptySlots > 0 ? <span className="text-xs text-muted">ยังว่าง {emptySlots} ช่อง</span> : undefined}
            bodyClassName="px-4 pb-5 sm:px-5"
          >
            {slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                ยังไม่มีทีม — ใส่จำนวนทีมที่ &quot;สร้างตารางการแข่งขัน&quot; หรือเพิ่มสโมสรด้านล่าง
              </p>
            ) : (
              <ul className="space-y-1.5">
                {slots.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
                    <span className="w-6 shrink-0 text-right text-xs text-muted tnum">{s.slot ?? "–"}</span>
                    {s.team.isPlaceholder ? (
                      <ActionForm action={assignSlotAction} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <input type="hidden" name="seasonTeamId" value={s.id} />
                        <span className="w-14 shrink-0 text-sm text-muted">{s.team.name}</span>
                        <select name="teamId" required defaultValue="" aria-label={`สโมสรของ${s.team.name}`} className={`${inputClass} min-w-0 flex-1 py-1.5`}>
                          <option value="" disabled>เลือกสโมสร…</option>
                          {otherClubs.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <SubmitButton variant="ghost" className="py-1.5">ใส่</SubmitButton>
                      </ActionForm>
                    ) : (
                      <form action={toggleSeasonTeamAction} className="flex min-w-0 flex-1 items-center gap-3">
                        <input type="hidden" name="seasonId" value={season.id} />
                        <input type="hidden" name="teamId" value={s.teamId} />
                        <TeamBadge name={s.team.name} code={s.team.code} logoUrl={s.team.logoUrl} color={s.team.color} color2={s.team.color2} size={24} />
                        <span className="min-w-0 flex-1 truncate text-sm">{s.team.name}</span>
                        <button className="rounded-lg border border-line bg-canvas px-3 py-1 text-xs font-medium text-muted transition hover:border-loss hover:text-loss">
                          เอาออก
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {otherClubs.length > 0 && (
              <details className="mt-4 border-t border-line pt-4" open={slots.length === 0}>
                <summary className="cursor-pointer text-sm font-medium">
                  สโมสรอื่น ({otherClubs.length}){emptySlots > 0 && <span className="font-normal text-muted"> · กดเพิ่มแล้วใส่ลงช่องว่างแรก</span>}
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {otherClubs.map((t) => (
                    <li key={t.id}>
                      <form action={toggleSeasonTeamAction} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
                        <input type="hidden" name="seasonId" value={season.id} />
                        <input type="hidden" name="teamId" value={t.id} />
                        <TeamBadge name={t.name} code={t.code} logoUrl={t.logoUrl} color={t.color} color2={t.color2} size={24} />
                        <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                        <button className="rounded-lg border border-brand bg-brand px-3 py-1 text-xs font-medium text-white transition">เพิ่ม</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {allTeams.length === 0 && (
              <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
                ยังไม่มีสโมสรในระบบ — <Link href="/admin/teams" className="underline">เพิ่มสโมสร</Link>
              </p>
            )}
          </Card>

          <Card title="สร้างตารางการแข่งขัน" bodyClassName="px-4 pb-5 sm:px-5">
            {lockedCount > 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                มี {lockedCount} นัดที่บันทึกผลไปแล้ว — ต้องลบหรือตีกลับผลเหล่านั้นก่อนจึงจะสร้างตารางใหม่ได้
                <br />
                <span className="text-xs">(ป้องกันไม่ให้ตารางคะแนนที่นับไปแล้วเสียหาย)</span>
              </p>
            ) : (
              <ActionForm action={generateFixturesAction} className="space-y-3">
                <input type="hidden" name="seasonId" value={season.id} />

                <FixtureFormat defaultTeams={slots.length || undefined} defaultRounds={season.rounds} max={MAX_TEAMS} required />

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="shuffle" className="size-4" />
                  สุ่มลำดับทีมก่อนจับคู่
                </label>

                <p className="text-xs text-muted">
                  ตารางที่ได้ยังไม่มีวันเวลา — ตั้งทีหลังที่{" "}
                  <Link href={`/admin/schedule?season=${encodeURIComponent(season.slug)}`} className="text-brand hover:underline">จัดวันเวลาแข่ง</Link>
                  {" "}· ทีมที่ยังไม่รู้จะแสดงเป็น &quot;ทีม 1, ทีม 2 …&quot; จนกว่าจะใส่สโมสร
                </p>

                <SubmitButton
                  confirm={
                    matchCount > 0
                      ? `จะลบตารางเดิม ${matchCount} คู่ (รวมวันเวลาที่ตั้งไว้) แล้วจับคู่ใหม่ ยืนยันไหม?`
                      : undefined
                  }
                >
                  {matchCount > 0 ? "สร้างตารางใหม่" : "สร้างตารางแข่ง"}
                </SubmitButton>
              </ActionForm>
            )}
          </Card>
      </div>

    </div>
  );
}

/** เวลาแข่งต่อนัด — กี่ช่วง ช่วงละกี่นาที ใช้กับนาฬิกาถ่ายทอดสดและปุ่มพัก/เริ่มช่วงถัดไป */
function MatchTimeFields({ periods, periodMinutes }: { periods: number; periodMinutes: number }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">เวลาแข่งต่อนัด</legend>
      <div className="grid grid-cols-2 gap-3">
        <Field label="แบ่งเป็น">
          <select name="periods" defaultValue={periods} className={inputClass}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="ช่วงละ (นาที)">
          <input type="number" name="periodMinutes" min={5} max={60} defaultValue={periodMinutes} required className={inputClass} />
        </Field>
      </div>
      <p className="mt-1 text-xs text-muted">
        เช่น 2 ครึ่ง × 45 = 90 นาที, 4 ควอเตอร์ × 12 = 48 นาที · ตอนนี้ {periods} × {periodMinutes} = {periods * periodMinutes} นาที
      </p>
    </fieldset>
  );
}

function NewSeasonForm() {
  return (
    <ActionForm action={saveSeasonAction} className="space-y-3">
      <Field label="ชื่อฤดูกาล">
        <input name="name" placeholder="เช่น 2027–28" required className={inputClass} />
      </Field>
      <FixtureFormat max={MAX_TEAMS} required />
      <MatchTimeFields periods={2} periodMinutes={45} />
      <p className="text-xs text-muted">
        ระบบจะสร้างตารางแข่งให้ครบทุกนัดทันที โดยใช้ชื่อ &quot;ทีม 1, ทีม 2 …&quot; ไว้ก่อน
        แล้วค่อยเลือกสโมสรใส่แต่ละช่อง และตั้งวันเวลาทีหลัง
      </p>
      <SubmitButton>สร้างฤดูกาล</SubmitButton>
    </ActionForm>
  );
}
