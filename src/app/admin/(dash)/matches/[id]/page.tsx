import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, StatusPill, TeamBadge } from "@/components/ui";
import { EventIcon, eventLabel } from "@/components/events";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { EventForm } from "@/components/admin/EventForm";
import {
  addEventAction,
  approveMatchAction,
  deleteEventAction,
  rejectMatchAction,
  saveMatchResultAction,
  updateMatchAction,
} from "@/server/actions";
import { requireSession } from "@/server/auth";
import { matchPermission } from "@/server/guards";
import { getMatchForAdmin, listActiveUsers, listMatchSquads } from "@/server/queries";
import { decodeParam, minuteLabel, thaiDateTime, toDateTimeLocal } from "@/lib/format";

export default async function AdminMatchPage({ params }: PageProps<"/admin/matches/[id]">) {
  const id = decodeParam((await params).id);
  const session = await requireSession();
  const admin = session.role === "ADMIN";

  const match = await getMatchForAdmin(id);
  if (!match) notFound();

  const permission = matchPermission(session, match);

  // กรรมการเข้าได้เฉพาะนัดของตัวเอง — ใช้กฎชุดเดียวกับที่ server action ใช้
  if (!admin && match.refereeId !== session.userId) {
    return (
      <Card>
        <p className="px-5 py-12 text-center text-muted">{permission.reason}</p>
      </Card>
    );
  }

  const locked = !permission.canEdit;

  const [squads, referees] = await Promise.all([
    listMatchSquads(match.homeTeamId, match.awayTeamId),
    permission.canManage ? listActiveUsers() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        <Link href="/admin/matches" className="hover:text-ink">← กลับรายการนัด</Link>
      </p>

      <Card bodyClassName="px-4 pb-5 sm:px-6">
        <div className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <TeamBadge name={match.homeTeam.name} code={match.homeTeam.code} logoUrl={match.homeTeam.logoUrl} color={match.homeTeam.color} size={40} />
            <span className="text-lg font-semibold">{match.homeTeam.shortName}</span>
            <span className="text-muted">พบ</span>
            <span className="text-lg font-semibold">{match.awayTeam.shortName}</span>
            <TeamBadge name={match.awayTeam.name} code={match.awayTeam.code} logoUrl={match.awayTeam.logoUrl} color={match.awayTeam.color} size={40} />
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

          {permission.canManage && (
            <Card title="รายละเอียดนัด" bodyClassName="px-4 pb-5 sm:px-5">
              <form action={updateMatchAction} className="space-y-3">
                <input type="hidden" name="matchId" value={match.id} />
                <Field label="วันและเวลาแข่ง">
                  <input type="datetime-local" name="kickoffAt" defaultValue={toDateTimeLocal(match.kickoffAt)} className={inputClass} />
                </Field>
                <Field label="สนาม">
                  <input name="venue" defaultValue={match.venue ?? ""} className={inputClass} />
                </Field>
                <Field label="ผู้ตัดสิน">
                  <select name="refereeId" defaultValue={match.refereeId ?? ""} className={inputClass}>
                    <option value="">— ยังไม่กำหนด —</option>
                    {referees.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.role === "ADMIN" ? "ผู้ดูแล" : "กรรมการ"})
                      </option>
                    ))}
                  </select>
                </Field>
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
              </form>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {!locked && (
            <Card title="เพิ่มเหตุการณ์" bodyClassName="px-4 pb-5 sm:px-5">
              <EventForm
                matchId={match.id}
                action={addEventAction}
                teams={[
                  { id: match.homeTeamId, name: match.homeTeam.shortName },
                  { id: match.awayTeamId, name: match.awayTeam.shortName },
                ]}
                players={squads}
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
