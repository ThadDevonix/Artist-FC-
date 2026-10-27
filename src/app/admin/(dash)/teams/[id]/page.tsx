import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PlayerAvatar, POSITION_LABEL, TeamBadge } from "@/components/ui";
import { SubmitButton } from "@/components/admin/Form";
import { PlayerForm } from "@/components/admin/PlayerForm";
import { RosterImport } from "@/components/admin/RosterImport";
import { Modal } from "@/components/admin/Modal";
import { TeamForm } from "@/components/admin/TeamForm";
import { deletePlayerAction, deleteTeamAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import { getPlayerById, getTeamById, listAllTeams, listPlayersForAdmin, teamIdsWithResults } from "@/server/queries";

export async function generateMetadata({ params }: PageProps<"/admin/teams/[id]">) {
  const team = await getTeamById((await params).id);
  return { title: team?.name ?? "สโมสร" };
}

export default async function TeamAdminPage({ params, searchParams }: PageProps<"/admin/teams/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  const playerId = typeof sp.player === "string" ? sp.player : undefined;
  const editTeam = sp.edit === "team"; // ลิงก์ ?edit=team จะเปิดป๊อปอัพแก้ไขสโมสรให้ทันที

  const [team, players, allTeams, editingPlayer, withResults] = await Promise.all([
    getTeamById(id),
    listPlayersForAdmin({ teamId: id }),
    listAllTeams(),
    playerId ? getPlayerById(playerId) : Promise.resolve(null),
    teamIdsWithResults(),
  ]);
  if (!team) notFound();

  const editing = editingPlayer?.teamId === team.id ? editingPlayer : null;
  const activeCount = players.filter((p) => p.active).length;
  const takenNumbers = players.filter((p) => p.active && p.number !== null).map((p) => p.number!);
  const base = `/admin/teams/${team.id}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/teams" className="text-sm text-muted hover:text-ink">‹ สโมสรทั้งหมด</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <TeamBadge name={team.name} code={team.code} logoUrl={team.logoUrl} color={team.color} color2={team.color2} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{team.name}</h1>
            <p className="text-sm text-muted">
              {team.code} · นักเตะ {activeCount} คน ·{" "}
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
                  confirm={`ลบ ${team.name}? นักเตะทั้ง ${players.length} คนในทีมจะถูกลบไปด้วย`}
                >
                  ลบสโมสรนี้
                </SubmitButton>
              </form>
            )}
          </Modal>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* ฟอร์มนักเตะอยู่บนสุดในมือถือ จะได้ไม่ต้องเลื่อนผ่านรายชื่อยาว ๆ */}
        <div className="space-y-6 lg:order-2">
          <Card title={editing ? "แก้ไขนักเตะ" : "เพิ่มนักเตะ"} bodyClassName="px-4 pb-5 sm:px-5">
            <PlayerForm teamId={team.id} player={editing} teams={allTeams} cancelHref={base} />
          </Card>

          {!editing && (
            <Card title="นำเข้านักเตะหลายคน" bodyClassName="px-4 pb-5 sm:px-5">
              <RosterImport teamId={team.id} takenNumbers={takenNumbers} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title={`รายชื่อนักเตะ (${players.length})`} bodyClassName="overflow-x-auto">
            {players.length === 0 ? (
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
                      className={`border-b border-line last:border-0 hover:bg-canvas ${!p.active ? "opacity-50" : ""} ${editing?.id === p.id ? "bg-brand-soft" : ""}`}
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
                          <Link href={`${base}?player=${p.id}`} className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-surface">
                            แก้ไข
                          </Link>
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
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}
