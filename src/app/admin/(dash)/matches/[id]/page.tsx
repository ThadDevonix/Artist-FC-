import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink, Card, LiveBadge, StatusPill, TeamBadge } from "@/components/ui";
import { EventIcon, eventLabel } from "@/components/events";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { EventForm } from "@/components/admin/EventForm";
import { StartLiveButton } from "@/components/admin/StartLiveButton";
import { LiveClock } from "@/components/LiveClock";
import { liveClockProps } from "@/lib/live-clock";
import {
  addEventAction,
  approveMatchAction,
  deleteEventAction,
  rejectMatchAction,
  finishLiveAction,
  saveMatchResultAction,
  setLivePhaseAction,
  startLiveAction,
  updateMatchAction,
} from "@/server/actions";
import { requireSession } from "@/server/auth";
import { isMatchOfficial, matchPermission } from "@/server/guards";
import { getMatchForAdmin, listActiveOfficials, listMatchSquads } from "@/server/queries";
import { decodeParam, minuteLabel, thaiDateTime, toDateTimeLocal } from "@/lib/format";

const OFFICIAL_SLOTS = [
  { name: "refereeId", label: "ผู้ตัดสิน" },
  { name: "assistant1Id", label: "ผู้ช่วยผู้ตัดสินที่ 1" },
  { name: "assistant2Id", label: "ผู้ช่วยผู้ตัดสินที่ 2" },
  { name: "fourthOfficialId", label: "ผู้ตัดสินที่ 4" },
] as const;

const SLOT_RELATION = {
  refereeId: "referee",
  assistant1Id: "assistant1",
  assistant2Id: "assistant2",
  fourthOfficialId: "fourthOfficial",
} as const;

export default async function AdminMatchPage({ params }: PageProps<"/admin/matches/[id]">) {
  const id = decodeParam((await params).id);
  const session = await requireSession();
  const admin = session.role === "ADMIN";

  const match = await getMatchForAdmin(id);
  if (!match) notFound();

  const permission = matchPermission(session, match);

  // กรรมการเข้าได้เฉพาะนัดที่ตัวเองอยู่ในทีมผู้ตัดสิน — ใช้กฎชุดเดียวกับที่ server action ใช้
  if (!admin && !isMatchOfficial(match, session.userId)) {
    return (
      <Card>
        <p className="px-5 py-12 text-center text-muted">{permission.reason}</p>
      </Card>
    );
  }

  const locked = !permission.canEdit;
  const clock = liveClockProps(match);

  const [squads, activeOfficials] = await Promise.all([
    listMatchSquads(match.homeTeamId, match.awayTeamId),
    permission.canManage ? listActiveOfficials() : Promise.resolve([]),
  ]);
  // คนที่ถูกตั้งไว้แล้วแต่ภายหลังปิดการทำหน้าที่ ยังต้องอยู่ในตัวเลือก ไม่งั้นบันทึกแล้วช่องจะหาย
  const assigned = [match.referee, match.assistant1, match.assistant2, match.fourthOfficial].filter((o) => o !== null);
  const officials = [...activeOfficials, ...assigned.filter((o) => !activeOfficials.some((a) => a.id === o.id))];

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/matches">รายการนัด</BackLink>
      </div>

      <Card bodyClassName="px-4 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <TeamBadge name={match.homeTeam.name} code={match.homeTeam.code} logoUrl={match.homeTeam.logoUrl} color={match.homeTeam.color} color2={match.homeTeam.color2} size={40} />
            <span className="text-lg font-semibold">{match.homeTeam.shortName}</span>
            <span className="text-muted">พบ</span>
            <span className="text-lg font-semibold">{match.awayTeam.shortName}</span>
            <TeamBadge name={match.awayTeam.name} code={match.awayTeam.code} logoUrl={match.awayTeam.logoUrl} color={match.awayTeam.color} color2={match.awayTeam.color2} size={40} />
          </div>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>นัดที่ {match.round} · {thaiDateTime(match.kickoffAt)}</span>
            <StatusPill status={match.status} />
          </div>
        </div>

        {(match.submittedBy || match.approvedBy) && (
          <p className="mt-3 text-xs text-muted">
            {match.submittedBy && `ส่งผลโดย ${match.submittedBy.name}`}
            {match.approvedBy && ` · อนุมัติโดย ${match.approvedBy.name}`}
          </p>
        )}
        {locked && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            นัดนี้อนุมัติแล้ว หากต้องแก้ไขกรุณาแจ้งผู้ดูแลระบบ
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-6">
          {!locked && (match.status === "SCHEDULED" || match.status === "POSTPONED") && (
            <Card title="ถ่ายทอดสด" bodyClassName="px-4 pb-5 sm:px-5">
              <p className="mb-3 text-sm text-muted">
                กดเริ่มตอนเตะออกจริง (นัดเลทก็กดตอนเตะได้เลย — เวลาเตะในโปรแกรมจะเปลี่ยนเป็นเวลาที่กด)
                แล้วบันทึกประตู/ใบเหลืองที่ &quot;เพิ่มเหตุการณ์&quot; ระหว่างเกม — สกอร์บนเว็บจะขึ้นเอง
              </p>
              <form action={startLiveAction}>
                <input type="hidden" name="matchId" value={match.id} />
                <StartLiveButton
                  kickoffAt={match.kickoffAt.toISOString()}
                  label={`${match.homeTeam.shortName} พบ ${match.awayTeam.shortName} (นัดที่ ${match.round})`}
                />
              </form>
            </Card>
          )}

          {match.status === "LIVE" && (
            <Card bodyClassName="px-4 py-5 sm:px-5" className={match.livePhase === "HALF_TIME" ? "halftime-glow" : "live-glow"}>
              <div className="flex items-center justify-center gap-3">
                <LiveBadge />
                <LiveClock {...clock} className="text-2xl" />
              </div>
              <div className="mt-2 flex justify-center">
                <LiveClock {...clock} variant="stopwatch" className="text-xl" />
              </div>
              <p className="mt-1 text-center text-xs text-muted">สกอร์นับจากเหตุการณ์ประตูอัตโนมัติ</p>
              <div className="my-4 flex items-center justify-center gap-4">
                <span className="flex min-w-0 flex-1 items-center justify-end gap-2 font-semibold">
                  <span className="truncate">{match.homeTeam.shortName}</span>
                  <TeamBadge name={match.homeTeam.name} code={match.homeTeam.code} logoUrl={match.homeTeam.logoUrl} color={match.homeTeam.color} color2={match.homeTeam.color2} size={32} />
                </span>
                <span className="rounded-xl bg-canvas px-4 py-2 text-3xl font-bold tnum">
                  {match.homeGoals ?? 0}–{match.awayGoals ?? 0}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
                  <TeamBadge name={match.awayTeam.name} code={match.awayTeam.code} logoUrl={match.awayTeam.logoUrl} color={match.awayTeam.color} color2={match.awayTeam.color2} size={32} />
                  <span className="truncate">{match.awayTeam.shortName}</span>
                </span>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <form action={setLivePhaseAction}>
                  <input type="hidden" name="matchId" value={match.id} />
                  <input type="hidden" name="phase" value="HALF_TIME" />
                  <SubmitButton variant="ghost" className="w-full" disabled={match.livePhase !== "FIRST_HALF"}>
                    ⏸ พักครึ่ง
                  </SubmitButton>
                </form>
                <form action={setLivePhaseAction}>
                  <input type="hidden" name="matchId" value={match.id} />
                  <input type="hidden" name="phase" value="SECOND_HALF" />
                  <SubmitButton variant="ghost" className="w-full" disabled={match.livePhase !== "HALF_TIME"}>
                    ▶ เริ่มครึ่งหลัง
                  </SubmitButton>
                </form>
              </div>
              <ActionForm action={finishLiveAction}>
                <input type="hidden" name="matchId" value={match.id} />
                <SubmitButton
                  className="w-full"
                  confirm={`จบเกมด้วยสกอร์ ${match.homeGoals ?? 0}–${match.awayGoals ?? 0}? ${admin ? "ผลจะถูกอนุมัติและนับในตารางคะแนนทันที" : "ผลจะถูกส่งให้ผู้ดูแลอนุมัติ"}`}
                >
                  ■ จบเกม {admin ? "และอนุมัติผล" : "และส่งผล"}
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          {match.status !== "LIVE" && (
            <Card title="สกอร์" bodyClassName="px-4 pb-5 sm:px-5">
              <ActionForm action={saveMatchResultAction} className="space-y-4">
                <input type="hidden" name="matchId" value={match.id} />

                <div className="flex items-end justify-center gap-4">
                  <div className="flex-1 text-center">
                    <span className="mb-2 block truncate text-sm font-medium">{match.homeTeam.shortName}</span>
                    <input
                      name="homeGoals"
                      type="number"
                      min={0}
                      max={99}
                      required
                      disabled={locked}
                      defaultValue={match.homeGoals ?? ""}
                      className="w-full rounded-xl border border-line bg-surface py-3 text-center text-2xl font-bold tnum outline-none focus:border-ink disabled:bg-canvas"
                    />
                  </div>
                  <span className="pb-4 text-xl text-muted">–</span>
                  <div className="flex-1 text-center">
                    <span className="mb-2 block truncate text-sm font-medium">{match.awayTeam.shortName}</span>
                    <input
                      name="awayGoals"
                      type="number"
                      min={0}
                      max={99}
                      required
                      disabled={locked}
                      defaultValue={match.awayGoals ?? ""}
                      className="w-full rounded-xl border border-line bg-surface py-3 text-center text-2xl font-bold tnum outline-none focus:border-ink disabled:bg-canvas"
                    />
                  </div>
                </div>

                <Field label="หมายเหตุ">
                  <textarea
                    name="notes"
                    rows={2}
                    disabled={locked}
                    defaultValue={match.notes ?? ""}
                    placeholder="เช่น เกมล่าช้าเพราะฝนตก"
                    className={inputClass}
                  />
                </Field>

                {!locked && (
                  <SubmitButton className="w-full">
                    {admin ? "บันทึกและอนุมัติ" : "ส่งผลให้ผู้ดูแลอนุมัติ"}
                  </SubmitButton>
          )}
            </ActionForm>

            {permission.canApprove && match.status === "PENDING" && (
              <div className="mt-4 flex gap-2 border-t border-line pt-4">
                <form action={approveMatchAction} className="flex-1">
                  <input type="hidden" name="matchId" value={match.id} />
                  <SubmitButton className="w-full">อนุมัติผลนี้</SubmitButton>
                </form>
                <form action={rejectMatchAction} className="flex-1">
                  <input type="hidden" name="matchId" value={match.id} />
                  <SubmitButton variant="danger" className="w-full" confirm="ตีกลับผลนี้? สกอร์จะถูกล้างและกลับเป็นยังไม่แข่ง">
                    ตีกลับ
                  </SubmitButton>
                </form>
              </div>
            )}
          </Card>
          )}

          {permission.canManage && (
            <Card>
              {/* พับไว้เป็นค่าเริ่มต้น — ระหว่างไลฟ์ไม่ค่อยได้ใช้ ตอนพับยังเห็นผู้ตัดสินและสนาม */}
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold">รายละเอียดนัด</span>
                    <span className="block truncate text-xs text-muted group-open:hidden">
                      {[match.referee ? `ผู้ตัดสิน ${match.referee.name}` : "ยังไม่กำหนดผู้ตัดสิน", match.venue].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm text-muted">
                    <span className="group-open:hidden">แก้ไข</span>
                    <span className="hidden group-open:inline">ย่อ</span>
                    <svg viewBox="0 0 24 24" className="size-5 transition group-open:rotate-180" fill="none" aria-hidden>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </summary>
                <div className="px-4 pb-5 sm:px-5">
                  <ActionForm action={updateMatchAction} className="space-y-3">
                    <input type="hidden" name="matchId" value={match.id} />
                    <Field label="วันและเวลาแข่ง">
                      <input type="datetime-local" name="kickoffAt" defaultValue={toDateTimeLocal(match.kickoffAt)} className={inputClass} />
                    </Field>
                    <Field label="สนาม">
                      <input name="venue" defaultValue={match.venue ?? ""} className={inputClass} />
                    </Field>
                    <fieldset className="space-y-3 rounded-xl border border-line p-3">
                      <legend className="px-1 text-sm font-medium">ทีมผู้ตัดสิน</legend>
                      {OFFICIAL_SLOTS.map((slot) => (
                        <Field key={slot.name} label={slot.label}>
                          <select name={slot.name} defaultValue={match[slot.name] ?? ""} className={inputClass}>
                            <option value="">— ยังไม่กำหนด —</option>
                            {officials.map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                          </select>
                        </Field>
                      ))}
                      {officials.length === 0 && (
                        <p className="text-xs text-muted">
                          ยังไม่มีรายชื่อผู้ตัดสิน — เพิ่มได้ที่เมนู{" "}
                          <Link href="/admin/officials" className="text-brand hover:underline">ผู้ตัดสิน</Link>
                        </p>
                      )}
                    </fieldset>
                    <Field label="สถานะ">
                      <select name="status" defaultValue={match.status} className={inputClass}>
                        <option value="SCHEDULED">ยังไม่แข่ง</option>
                        <option value="LIVE">กำลังแข่ง</option>
                        <option value="PENDING">รออนุมัติ</option>
                        <option value="FINISHED">อนุมัติแล้ว</option>
                        <option value="POSTPONED">เลื่อน</option>
                        <option value="CANCELLED">ยกเลิก</option>
                      </select>
                    </Field>
                    <SubmitButton variant="ghost">บันทึกรายละเอียด</SubmitButton>
                  </ActionForm>
                </div>
              </details>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {!locked && (
            <Card title="เพิ่มเหตุการณ์" bodyClassName="px-4 pb-5 sm:px-5">
              <EventForm
                matchId={match.id}
                action={addEventAction}
                teams={[match.homeTeam, match.awayTeam].map((t, i) => ({
                  id: t.id,
                  name: t.shortName,
                  fullName: t.name,
                  code: t.code,
                  logoUrl: t.logoUrl,
                  color: t.color,
                  color2: t.color2,
                  side: i === 0 ? "เหย้า" : "เยือน",
                }))}
                players={squads}
                liveClock={match.status === "LIVE" ? clock : undefined}
                officials={OFFICIAL_SLOTS.flatMap((slot) => {
                  const o = match[SLOT_RELATION[slot.name]];
                  return o ? [{ id: o.id, name: o.name, slot: slot.label }] : [];
                })}
              />
            </Card>
          )}

          <Card title={`เหตุการณ์ (${match.events.length})`}>
            {match.events.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">
                ยังไม่มีเหตุการณ์ — เพิ่มประตูและใบเหลือง/แดงได้จากฟอร์มด้านบน
              </p>
            ) : (
              <ul>
                {match.events.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 sm:px-5">
                    <span className="w-12 shrink-0 text-xs text-muted tnum">{minuteLabel(e.minute, e.extraMinute)}</span>
                    <span className="shrink-0"><EventIcon type={e.type} /></span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{e.player?.name ?? "—"}</span>
                      <span className="block text-xs text-muted">
                        {e.team.shortName} · {eventLabel(e.type)}
                        {e.assistPlayer ? ` · จ่ายโดย ${e.assistPlayer.name}` : ""}
                        {e.issuedBy ? ` · ให้โดย ${e.issuedBy.name}` : ""}
                      </span>
                    </span>
                    {!locked && (
                      <form action={deleteEventAction} className="shrink-0">
                        <input type="hidden" name="eventId" value={e.id} />
                        <button className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition hover:border-loss hover:text-loss">
                          ลบ
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
