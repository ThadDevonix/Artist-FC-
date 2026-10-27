import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, EditingTitle, PlayerAvatar, POSITION_LABEL, TeamBadge } from "@/components/ui";
import { SubmitButton } from "@/components/admin/Form";
import { EditLink } from "@/components/admin/EditLink";
import { EDIT_FORM_ID, editingCardClass, editingRowClass } from "@/components/admin/editing";
import { PlayerForm } from "@/components/admin/PlayerForm";
import { RosterImport } from "@/components/admin/RosterImport";
import { StaffForm } from "@/components/admin/StaffForm";
import { Modal } from "@/components/admin/Modal";
import { TeamForm } from "@/components/admin/TeamForm";
import { staffRoleName } from "@/lib/labels";
import { deletePlayerAction, deleteStaffAction, deleteTeamAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import {
  getPlayerById,
  getStaffById,
  getTeamById,
  listAllTeams,
  listPlayersForAdmin,
  listTeamStaff,
  teamIdsWithResults,
} from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/admin/teams/[id]">) {
  const team = await getTeamById((await params).id);
  return { title: team?.name ?? "สโมสร" };
}

export default async function TeamAdminPage({ params, searchParams }: PageProps<"/admin/teams/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "staff" ? "staff" : "players";
  const playerId = typeof sp.player === "string" ? sp.player : undefined;
  const staffId = typeof sp.staff === "string" ? sp.staff : undefined;
  const editTeam = sp.edit === "team"; // ลิงก์ ?edit=team จะเปิดป๊อปอัพแก้ไขสโมสรให้ทันที

  const [team, players, staff, allTeams, editingPlayer, editingStaff, withResults] = await Promise.all([
    getTeamById(id),
    listPlayersForAdmin({ teamId: id }),
    listTeamStaff(id, { includeInactive: true }),
    listAllTeams(),
    playerId ? getPlayerById(playerId) : Promise.resolve(null),
    staffId ? getStaffById(staffId) : Promise.resolve(null),
    teamIdsWithResults(),
  ]);
  if (!team) notFound();

  const editing = editingPlayer?.teamId === team.id ? editingPlayer : null;
  const editingS = editingStaff?.teamId === team.id ? editingStaff : null;
  const activeCount = players.filter((p) => p.active).length;
  const takenNumbers = players.filter((p) => p.active && p.number !== null).map((p) => p.number!);
  const base = `/admin/teams/${team.id}`;
  const staffBase = `${base}?tab=staff`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/teams" className="text-sm text-muted hover:text-ink">‹ สโมสรทั้งหมด</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <TeamBadge name={team.name} code={team.code} logoUrl={team.logoUrl} color={team.color} color2={team.color2} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{team.name}</h1>
            <p className="text-sm text-muted">
              {team.code} · นักเตะ {activeCount} คน · ทีมงาน {staff.filter((s) => s.active).length} คน ·{" "}
              <Link href={`/teams/${team.slug}`} className="hover:text-brand">ดูหน้าเว็บ ›</Link>
            </p>
          </div>
          <Modal
            title="แก้ไขสโมสร"
            defaultOpen={editTeam}
            triggerClassName="inline-flex shrink-0 items-center gap-2 rounded-lg border-2 border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
            trigger={
              <>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
                  <path d="M4 20h4L18.5 9.5a2.1 2.1 0 00-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                แก้ไขสโมสร
              </>
            }
          >
            <TeamForm team={team} />
            {!withResults.has(team.id) && (
              <form action={deleteTeamAction} className="mt-5 border-t border-line pt-4">
                <input type="hidden" name="id" value={team.id} />
                <SubmitButton
                  variant="danger"
                  confirm={`ลบ ${team.name}? นักเตะ ${players.length} คนและทีมงาน ${staff.length} คนในทีมจะถูกลบไปด้วย`}
                >
                  ลบสโมสรนี้
                </SubmitButton>
              </form>
            )}
          </Modal>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* ฟอร์มอยู่บนสุดในมือถือ จะได้ไม่ต้องเลื่อนผ่านรายชื่อยาว ๆ */}
        <div className="space-y-6 lg:order-2">
          {tab === "players" ? (
            <>
              <Card
                id={EDIT_FORM_ID}
                title={editing ? <EditingTitle label="แก้ไขนักเตะ" name={editing.name} /> : "เพิ่มนักเตะ"}
                className={editing ? editingCardClass : "scroll-mt-32"}
                bodyClassName="px-4 pb-5 sm:px-5"
              >
                <PlayerForm teamId={team.id} player={editing} teams={allTeams} cancelHref={base} color={team.color} color2={team.color2} />
              </Card>
              <Card title="นำเข้านักเตะหลายคน" bodyClassName="px-4 pb-5 sm:px-5">
                <RosterImport teamId={team.id} takenNumbers={takenNumbers} />
              </Card>
            </>
          ) : (
            <Card
              id={EDIT_FORM_ID}
              title={editingS ? <EditingTitle label="แก้ไขทีมงาน" name={editingS.name} /> : "เพิ่มทีมงาน"}
              className={editingS ? editingCardClass : "scroll-mt-32"}
              bodyClassName="px-4 pb-5 sm:px-5"
            >
              <StaffForm teamId={team.id} staff={editingS} cancelHref={staffBase} color={team.color} color2={team.color2} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card
            title={
              <nav className="flex gap-1 rounded-xl bg-canvas p-1 text-sm">
                <TabLink href={base} active={tab === "players"}>นักเตะ ({players.length})</TabLink>
                <TabLink href={staffBase} active={tab === "staff"}>ทีมงาน ({staff.length})</TabLink>
              </nav>
            }
            bodyClassName="overflow-x-auto"
          >
            {tab === "players" ? (
              players.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีนักเตะ เพิ่มทีละคนหรือนำเข้าจากไฟล์</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="w-9 py-2 pl-3 text-center font-medium sm:w-12 sm:pl-4">#</th>
                      <th className="py-2 text-left font-medium">ชื่อ</th>
                      <th className="hidden w-28 py-2 text-left font-medium sm:table-cell">ตำแหน่ง</th>
                      <th className="w-24 py-2 pr-3 text-right font-medium sm:w-28 sm:pr-4">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-b border-line last:border-0 ${editing?.id === p.id ? editingRowClass : "hover:bg-canvas"} ${!p.active ? "opacity-50" : ""}`}
                      >
                        <td className="py-2 pl-3 text-center tnum text-muted sm:pl-4">{p.number ?? "—"}</td>
                        <td className="min-w-0 py-2 pr-2">
                          <span className="flex items-center gap-2.5">
                            <PlayerAvatar name={p.name} photoUrl={p.photoUrl} color={team.color} color2={team.color2} size={34} />
                            <span className="min-w-0">
                              <span className="block font-medium">{p.name}</span>
                              <span className="block text-xs text-muted sm:hidden">
                                {POSITION_LABEL[p.position]}
                                {!p.active && " · ไม่อยู่ในทีมแล้ว"}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="hidden py-2 text-muted sm:table-cell">
                          {POSITION_LABEL[p.position]}
                          {!p.active && <span className="block text-xs">ไม่อยู่ในทีมแล้ว</span>}
                        </td>
                        <td className="py-2 pr-3 text-right sm:pr-4">
                          <span className="inline-flex gap-1.5">
                            <EditLink href={`${base}?player=${p.id}`} active={editing?.id === p.id} />
                            <form action={deletePlayerAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <SubmitButton variant="ghost" className="!px-2.5 !py-1 !text-xs" confirm={`ลบ ${p.name}? เหตุการณ์ในเกมที่อ้างถึงนักเตะคนนี้จะไม่มีชื่อกำกับ`}>
                                ลบ
                              </SubmitButton>
                            </form>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : staff.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีทีมงาน เริ่มจากเพิ่มหัวหน้าผู้ฝึกสอน</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="py-2 pl-3 text-left font-medium sm:pl-4">ชื่อ</th>
                    <th className="hidden py-2 text-left font-medium sm:table-cell">ตำแหน่ง</th>
                    <th className="w-24 py-2 pr-3 text-right font-medium sm:w-28 sm:pr-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b border-line last:border-0 ${editingS?.id === s.id ? editingRowClass : "hover:bg-canvas"} ${!s.active ? "opacity-50" : ""}`}
                    >
                      <td className="min-w-0 py-2 pl-3 pr-2 sm:pl-4">
                        <span className="flex items-center gap-2.5">
                          <PlayerAvatar name={s.name} photoUrl={s.photoUrl} color={team.color} color2={team.color2} size={34} />
                          <span className="min-w-0">
                            <span className="block font-medium">{s.name}</span>
                            <span className="block text-xs text-muted sm:hidden">
                              {staffRoleName(s)}
                              {!s.active && " · ไม่อยู่ในทีมแล้ว"}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="hidden py-2 text-muted sm:table-cell">
                        {staffRoleName(s)}
                        {!s.active && <span className="block text-xs">ไม่อยู่ในทีมแล้ว</span>}
                      </td>
                      <td className="py-2 pr-3 text-right sm:pr-4">
                        <span className="inline-flex gap-1.5">
                          <EditLink href={`${staffBase}&staff=${s.id}`} active={editingS?.id === s.id} />
                          <form action={deleteStaffAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <SubmitButton variant="ghost" className="!px-2.5 !py-1 !text-xs" confirm={`ลบ ${s.name} ออกจากทีมงาน?`}>
                              ลบ
                            </SubmitButton>
                          </form>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-4 py-1.5 font-medium transition ${active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
