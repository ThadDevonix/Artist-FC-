import Link from "next/link";
import { Card, TeamBadge } from "@/components/ui";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { deleteTeamAction, saveTeamAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import { getTeamById, listTeamsWithPlayerCount, teamIdsWithResults } from "@/server/queries";

export const metadata = { title: "สโมสร" };

export default async function TeamsPage({ searchParams }: PageProps<"/admin/teams">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;

  const [teams, editing, hasMatches] = await Promise.all([
    listTeamsWithPlayerCount(),
    editId ? getTeamById(editId) : Promise.resolve(null),
    // ทีมที่มีผลแข่งแล้วจะลบไม่ได้ เพื่อไม่ให้ตารางคะแนนย้อนหลังเสียหาย
    teamIdsWithResults(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สโมสร</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card title={editing ? "แก้ไขสโมสร" : "เพิ่มสโมสร"} bodyClassName="px-4 pb-5 sm:px-5">
          <ActionForm action={saveTeamAction} className="space-y-3" key={editing?.id ?? "new"}>
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <Field label="ชื่อสโมสร">
              <input name="name" defaultValue={editing?.name ?? ""} required className={inputClass} placeholder="เช่น ลูกทุ่ง ยูไนเต็ด" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ชื่อย่อ" hint="ใช้ในตารางคะแนน">
                <input name="shortName" defaultValue={editing?.shortName ?? ""} className={inputClass} placeholder="ลูกทุ่ง" />
              </Field>
              <Field label="รหัส 3 ตัว">
                <input name="code" defaultValue={editing?.code ?? ""} maxLength={4} className={inputClass} placeholder="LTU" />
              </Field>
            </div>
            <Field label="URL โลโก้" hint="เว้นว่างได้ ระบบจะใช้วงกลมสีประจำทีมแทน">
              <input name="logoUrl" defaultValue={editing?.logoUrl ?? ""} className={inputClass} placeholder="https://…" />
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="เมือง">
                <input name="city" defaultValue={editing?.city ?? ""} className={inputClass} />
              </Field>
              <Field label="สีประจำทีม">
                <input type="color" name="color" defaultValue={editing?.color ?? "#1f2937"} className="h-9 w-16 rounded-lg border border-line" />
              </Field>
            </div>
            <Field label="สีที่ 2" hint="ไม่ติ๊ก = ใช้สีเดียว · ติ๊ก = วงกลมผ่าครึ่ง บนสีหลัก ล่างสีที่ 2">
              <span className="flex items-center gap-3 text-sm">
                <input type="checkbox" name="useColor2" defaultChecked={!!editing?.color2} className="size-4 accent-brand" />
                ใช้ 2 สี
                <input type="color" name="color2" defaultValue={editing?.color2 ?? "#ffffff"} className="h-9 w-16 rounded-lg border border-line" />
              </span>
            </Field>
            <Field label="สนามเหย้า">
              <input name="venue" defaultValue={editing?.venue ?? ""} className={inputClass} />
            </Field>
            <Field label="ปีที่ก่อตั้ง">
              <input type="number" name="founded" defaultValue={editing?.founded ?? ""} className={inputClass} />
            </Field>

            <div className="flex gap-2">
              <SubmitButton>{editing ? "บันทึก" : "เพิ่มสโมสร"}</SubmitButton>
              {editing && (
                <Link href="/admin/teams" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">
                  ยกเลิก
                </Link>
              )}
            </div>
          </ActionForm>
        </Card>

        <Card bodyClassName="overflow-x-auto">
          {teams.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีสโมสร</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pl-3 text-left font-medium sm:pl-4">สโมสร</th>
                  <th className="hidden w-20 py-2 text-center font-medium sm:table-cell">นักเตะ</th>
                  <th className="hidden py-2 text-left font-medium md:table-cell">สนาม</th>
                  <th className="w-24 py-2 pr-3 text-right font-medium sm:w-28 sm:pr-4">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="min-w-0 py-2.5 pl-3 sm:pl-4">
                      <span className="flex items-center gap-2.5">
                        <TeamBadge name={t.name} code={t.code} logoUrl={t.logoUrl} color={t.color} color2={t.color2} size={26} />
                        <span>
                          <span className="block font-medium">{t.name}</span>
                          <span className="block text-xs text-muted">{t.code} · {t.city ?? "—"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden py-2.5 text-center tnum sm:table-cell">{t._count.players}</td>
                    <td className="hidden py-2.5 text-muted md:table-cell">{t.venue ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right sm:pr-4">
                      <span className="inline-flex gap-1.5">
                        <Link href={`/admin/teams?edit=${t.id}`} className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-surface">
                          แก้ไข
                        </Link>
                        {!hasMatches.has(t.id) && (
                          <form action={deleteTeamAction}>
                            <input type="hidden" name="id" value={t.id} />
                            <SubmitButton variant="ghost" className="!px-2.5 !py-1 !text-xs" confirm={`ลบ ${t.name}? นักเตะในทีมจะไม่สังกัดทีมใด`}>
                              ลบ
                            </SubmitButton>
                          </form>
                        )}
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
  );
}
