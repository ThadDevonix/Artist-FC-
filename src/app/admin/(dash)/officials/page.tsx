import Link from "next/link";
import { Card, EditingTitle, PlayerAvatar } from "@/components/ui";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { EditLink } from "@/components/admin/EditLink";
import { EDIT_FORM_ID, editingCardClass, editingRowClass } from "@/components/admin/editing";
import { PlayerPhotoInput } from "@/components/admin/PlayerPhotoInput";
import { deleteOfficialAction, saveOfficialAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import { getOfficialById, listActiveUsers, listOfficials } from "@/server/queries";

export const metadata = { title: "ผู้ตัดสิน" };

const NEUTRAL = "#374151";

export default async function OfficialsPage({ searchParams }: PageProps<"/admin/officials">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;

  const [officials, users, editing] = await Promise.all([
    listOfficials(),
    listActiveUsers(),
    editId ? getOfficialById(editId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ผู้ตัดสิน</h1>
        <p className="mt-1 text-sm text-muted">
          รายชื่อผู้ตัดสินที่ใช้จัดทีมผู้ตัดสินในแต่ละนัด (ผู้ตัดสิน · ผู้ช่วย 2 คน · ผู้ตัดสินที่ 4) ·
          ผูกกับบัญชีผู้ใช้ได้ ถ้าคนนั้นต้องล็อกอินมาบันทึกผลนัดที่ตัวเองตัดสิน
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card
          id={EDIT_FORM_ID}
          title={editing ? <EditingTitle label="แก้ไขผู้ตัดสิน" name={editing.name} /> : "เพิ่มผู้ตัดสิน"}
          className={editing ? editingCardClass : "scroll-mt-32"}
          bodyClassName="px-4 pb-5 sm:px-5"
        >
          <ActionForm action={saveOfficialAction} className="space-y-3" key={editing?.id ?? "new"} successHref={editing ? "/admin/officials" : undefined}>
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <PlayerPhotoInput name={editing?.name ?? ""} currentUrl={editing?.photoUrl ?? null} color={NEUTRAL} color2={null} />

            <Field label="ชื่อ-สกุล">
              <input name="name" defaultValue={editing?.name ?? ""} required autoFocus={!!editing} className={inputClass} />
            </Field>
            <Field label="ระดับ / สังกัด" hint="เช่น ผู้ตัดสินระดับ 1, สมาคมฯ ภาคอีสาน">
              <input name="level" defaultValue={editing?.level ?? ""} className={inputClass} />
            </Field>
            <Field label="สัญชาติ">
              <input name="nationality" defaultValue={editing?.nationality ?? ""} className={inputClass} />
            </Field>
            <Field label="ผูกกับบัญชีผู้ใช้" hint="ไม่บังคับ — ผูกแล้วบัญชีนั้นบันทึกผลนัดที่คนนี้อยู่ในทีมผู้ตัดสินได้">
              <select name="userId" defaultValue={editing?.userId ?? ""} className={inputClass}>
                <option value="">— ไม่ผูก (ไม่ได้ใช้ระบบ) —</option>
                {users.map((u) => {
                  const takenByOther = u.official && u.official.id !== editing?.id;
                  return (
                    <option key={u.id} value={u.id} disabled={!!takenByOther}>
                      {u.name} ({u.role === "ADMIN" ? "ผู้ดูแล" : "กรรมการ"}){takenByOther ? " — ผูกกับผู้ตัดสินคนอื่นแล้ว" : ""}
                    </option>
                  );
                })}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="size-4" />
              ยังทำหน้าที่อยู่ (แสดงในตัวเลือกทีมผู้ตัดสิน)
            </label>

            <div className="flex gap-2">
              <SubmitButton>{editing ? "บันทึก" : "เพิ่มผู้ตัดสิน"}</SubmitButton>
              {editing && (
                <Link href="/admin/officials" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">
                  ยกเลิก
                </Link>
              )}
            </div>
          </ActionForm>
        </Card>

        <Card bodyClassName="overflow-x-auto">
          {officials.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีผู้ตัดสิน</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pl-3 text-left font-medium sm:pl-4">ชื่อ</th>
                  <th className="hidden py-2 text-left font-medium md:table-cell">บัญชีผู้ใช้</th>
                  <th className="hidden w-24 py-2 text-center font-medium sm:table-cell">ตัดสิน (นัด)</th>
                  <th className="w-24 py-2 pr-3 text-right font-medium sm:w-28 sm:pr-4">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {officials.map((o) => (
                  <tr
                    key={o.id}
                    className={`border-b border-line last:border-0 ${editing?.id === o.id ? editingRowClass : "hover:bg-canvas"} ${!o.active ? "opacity-50" : ""}`}
                  >
                    <td className="min-w-0 py-2 pl-3 pr-2 sm:pl-4">
                      <span className="flex items-center gap-2.5">
                        <PlayerAvatar name={o.name} photoUrl={o.photoUrl} color={NEUTRAL} size={34} />
                        <span className="min-w-0">
                          <span className="block font-medium">{o.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {[o.level, !o.active ? "ไม่ได้ทำหน้าที่แล้ว" : null].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden py-2 text-muted md:table-cell">
                      {o.user ? (
                        <>
                          {o.user.name}
                          <span className="block text-xs">{o.user.email}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden py-2 text-center tnum sm:table-cell">{o._count.refereeMatches}</td>
                    <td className="py-2 pr-3 text-right sm:pr-4">
                      <span className="inline-flex gap-1.5">
                        <EditLink href={`/admin/officials?edit=${o.id}`} active={editing?.id === o.id} />
                        <form action={deleteOfficialAction}>
                          <input type="hidden" name="id" value={o.id} />
                          <SubmitButton
                            variant="ghost"
                            className="!px-2.5 !py-1 !text-xs"
                            confirm={`ลบ ${o.name}? นัดที่มีคนนี้ในทีมผู้ตัดสินจะว่างช่องนั้น (ถ้าแค่เลิกทำหน้าที่ ให้แก้ไขแล้วเอาติ๊ก "ยังทำหน้าที่อยู่" ออกแทน)`}
                          >
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
  );
}
