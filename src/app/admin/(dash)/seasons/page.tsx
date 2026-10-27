import Link from "next/link";
import { Card, TeamBadge } from "@/components/ui";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { TypeToConfirm } from "@/components/admin/TypeToConfirm";
import { FixtureFormat } from "@/components/admin/FixtureFormat";
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
  listAllTeams,
  listSeasons,
  listSeasonSlots,
  listSeasonZones,
} from "@/server/queries";
import { MAX_TEAMS } from "@/server/validation";
import { parseTiebreakers, TIEBREAKER_LABELS, type Tiebreaker } from "@/lib/standings";

export const metadata = { title: "ฤดูกาล" };

const ALL_TIEBREAKERS = Object.keys(TIEBREAKER_LABELS) as Tiebreaker[];

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

  const [allTeams, slots, zones, counts] = await Promise.all([
    listAllTeams(),
    listSeasonSlots(season.id),
    listSeasonZones(season.id),
    getSeasonMatchCounts(season.id),
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
        <div className="flex flex-wrap gap-2">
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`/admin/seasons?season=${s.slug}`}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                s.id === season.id ? "border-ink bg-surface font-medium" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {s.name}
              {s.isActive && <span className="ml-1.5 text-xs text-win">● ใช้งานอยู่</span>}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="ตั้งค่าฤดูกาล" bodyClassName="px-4 pb-5 sm:px-5">
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

            <Field label="ความยาวครึ่ง (นาที)" hint="ใช้กับนาฬิกาถ่ายทอดสด เช่น 45 = 45+45 นาที, 30 = 30+30 นาที">
              <input type="number" name="halfMinutes" min={10} max={60} defaultValue={season.halfMinutes} className={inputClass} />
            </Field>

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

            <div className="flex gap-2">
              <SubmitButton>บันทึกการตั้งค่า</SubmitButton>
              {!season.isActive && (
                <span className="text-xs text-muted self-center">
                  ฤดูกาลนี้ยังไม่ใช่ฤดูกาลที่แสดงบนหน้าเว็บ
                </span>
              )}
            </div>
          </ActionForm>

          {!season.isActive && (
            <form action={activateSeasonAction} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="id" value={season.id} />
              <SubmitButton variant="ghost">ตั้งเป็นฤดูกาลที่ใช้งานอยู่</SubmitButton>
            </form>
          )}

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
        </Card>

        <div className="space-y-6">
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

      <Card title="โซนสีในตารางคะแนน" bodyClassName="px-4 pb-5 sm:px-5">
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
      </Card>

      <Card title="สร้างฤดูกาลใหม่" bodyClassName="px-4 pb-5 sm:px-5">
        <NewSeasonForm />
      </Card>
    </div>
  );
}

function NewSeasonForm() {
  return (
    <ActionForm action={saveSeasonAction} className="space-y-3">
      <Field label="ชื่อฤดูกาล">
        <input name="name" placeholder="เช่น 2027–28" required className={inputClass} />
      </Field>
      <FixtureFormat max={MAX_TEAMS} required />
      <p className="text-xs text-muted">
        ระบบจะสร้างตารางแข่งให้ครบทุกนัดทันที โดยใช้ชื่อ &quot;ทีม 1, ทีม 2 …&quot; ไว้ก่อน
        แล้วค่อยเลือกสโมสรใส่แต่ละช่อง และตั้งวันเวลาทีหลัง
      </p>
      <SubmitButton>สร้างฤดูกาล</SubmitButton>
    </ActionForm>
  );
}
