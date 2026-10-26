import Link from "next/link";
import { Card, POSITION_LABEL, TeamBadge } from "@/components/ui";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { deletePlayerAction, savePlayerAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import { getPlayerById, listAllTeams, listPlayersForAdmin } from "@/server/queries";

export const metadata = { title: "นักเตะ" };

const POSITIONS = ["GK", "DF", "MF", "FW"] as const;

export default async function PlayersAdminPage({ searchParams }: PageProps<"/admin/players">) {
  await requireRole("ADMIN");
  const sp = await searchParams;

  const editId = typeof sp.edit === "string" ? sp.edit : undefined;
  const teamFilter = typeof sp.team === "string" ? sp.team : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const [teams, players, editing] = await Promise.all([
    listAllTeams(),
    listPlayersForAdmin({ teamId: teamFilter, search: q || undefined }),
    editId ? getPlayerById(editId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">นักเตะ</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card title={editing ? "แก้ไขนักเตะ" : "เพิ่มนักเตะ"} bodyClassName="px-4 pb-5 sm:px-5">
          <ActionForm action={savePlayerAction} className="space-y-3" key={editing?.id ?? "new"}>
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <Field label="ชื่อ-สกุล">
              <input name="name" defaultValue={editing?.name ?? ""} required className={inputClass} />
            </Field>
            <Field label="สังกัดทีม">
              <select name="teamId" defaultValue={editing?.teamId ?? teamFilter ?? ""} className={inputClass}>
                <option value="">— ไม่สังกัดทีม —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="เบอร์เสื้อ">
                <input type="number" name="number" min={1} max={99} defaultValue={editing?.number ?? ""} className={inputClass} />
              </Field>
              <Field label="ตำแหน่ง">
                <select name="position" defaultValue={editing?.position ?? "MF"} className={inputClass}>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{POSITION_LABEL[p]}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="สัญชาติ">
                <input name="nationality" defaultValue={editing?.nationality ?? ""} className={inputClass} />
              </Field>
              <Field label="วันเกิด">
                <input type="date" name="birthDate" defaultValue={editing?.birthDate?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
              </Field>
            </div>
            <Field label="URL รูปภาพ">
              <input name="photoUrl" defaultValue={editing?.photoUrl ?? ""} className={inputClass} placeholder="https://…" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="size-4" />
              ยังอยู่ในทีม (แสดงบนหน้าเว็บ)
            </label>

            <div className="flex gap-2">
              <SubmitButton>{editing ? "บันทึก" : "เพิ่มนักเตะ"}</SubmitButton>
              {editing && (
                <Link href="/admin/players" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">
                  ยกเลิก
                </Link>
              )}
            </div>
          </ActionForm>
        </Card>

        <div className="space-y-4">
          <form action="/admin/players" className="flex gap-2">
            {teamFilter && <input type="hidden" name="team" value={teamFilter} />}
            <input name="q" defaultValue={q} placeholder="ค้นหาชื่อนักเตะ" className={inputClass} />
            <SubmitButton variant="ghost">ค้นหา</SubmitButton>
          </form>

          <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <Link
              href={`/admin/players${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${!teamFilter ? "border-ink bg-surface font-medium" : "border-line bg-surface text-muted"}`}
            >
              ทุกทีม
            </Link>
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/admin/players?team=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                  teamFilter === t.id ? "border-ink bg-surface font-medium" : "border-line bg-surface text-muted"
                }`}
              >
                <TeamBadge name={t.name} logoUrl={t.logoUrl} color={t.color} size={16} />
                {t.shortName}
              </Link>
            ))}
          </div>

          <Card bodyClassName="overflow-x-auto">
            {players.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted">ไม่พบนักเตะ</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="w-9 py-2 pl-3 text-center font-medium sm:w-12 sm:pl-4">#</th>
                    <th className="py-2 text-left font-medium">ชื่อ</th>
                    <th className="hidden py-2 text-left font-medium sm:table-cell">ทีม</th>
                    <th className="hidden w-20 py-2 text-center font-medium md:table-cell">ตำแหน่ง</th>
                    <th className="w-24 py-2 pr-3 text-right font-medium sm:w-28 sm:pr-4">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id} className={`border-b border-line last:border-0 hover:bg-canvas ${!p.active ? "opacity-50" : ""}`}>
                      <td className="py-2 pl-3 text-center tnum text-muted sm:pl-4">{p.number ?? "—"}</td>
                      <td className="min-w-0 py-2 pr-2 font-medium">
                        {p.name}
                        <span className="block text-xs font-normal text-muted sm:hidden">
                          {p.team?.shortName ?? "ไม่สังกัดทีม"} · {p.position}
                        </span>
                      </td>
                      <td className="hidden py-2 sm:table-cell">
                        {p.team ? (
                          <span className="flex items-center gap-2 text-muted">
                            <TeamBadge name={p.team.name} logoUrl={p.team.logoUrl} color={p.team.color} size={18} />
                            {p.team.shortName}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="hidden py-2 text-center text-xs text-muted md:table-cell">{p.position}</td>
                      <td className="py-2 pr-3 text-right sm:pr-4">
                        <span className="inline-flex gap-1.5">
                          <Link href={`/admin/players?edit=${p.id}`} className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-surface">
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
