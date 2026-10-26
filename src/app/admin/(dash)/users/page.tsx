import Link from "next/link";
import { Card } from "@/components/ui";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { deleteUserAction, saveUserAction } from "@/server/actions";
import { requireRole } from "@/server/auth";
import { getUserById, listUsers } from "@/server/queries";
import { thaiDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";

export const metadata = { title: "ผู้ใช้งาน" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const session = await requireRole("ADMIN");
  const sp = await searchParams;
  const editId = typeof sp.edit === "string" ? sp.edit : undefined;

  const [users, editing] = await Promise.all([
    listUsers(),
    editId ? getUserById(editId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ผู้ใช้งาน</h1>
        <p className="mt-1 text-sm text-muted">
          <strong>ผู้ดูแลระบบ</strong> จัดการได้ทุกอย่างและอนุมัติผลการแข่งขัน ·{" "}
          <strong>กรรมการ</strong> บันทึกผลได้เฉพาะนัดที่ได้รับมอบหมาย และต้องรอการอนุมัติ
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card title={editing ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"} bodyClassName="px-4 pb-5 sm:px-5">
          <ActionForm action={saveUserAction} className="space-y-3" key={editing?.id ?? "new"}>
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <Field label="ชื่อ-สกุล">
              <input name="name" defaultValue={editing?.name ?? ""} required className={inputClass} />
            </Field>
            <Field label="อีเมล">
              <input type="email" name="email" defaultValue={editing?.email ?? ""} required className={inputClass} />
            </Field>
            <Field
              label="รหัสผ่าน"
              hint={editing ? "เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน" : "อย่างน้อย 8 ตัวอักษร"}
            >
              <input type="password" name="password" autoComplete="new-password" className={inputClass} />
            </Field>
            <Field label="สิทธิ์">
              <select name="role" defaultValue={editing?.role ?? "REFEREE"} className={inputClass}>
                <option value="REFEREE">กรรมการ</option>
                <option value="ADMIN">ผู้ดูแลระบบ</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="size-4" />
              เปิดใช้งานบัญชีนี้
            </label>

            <div className="flex gap-2">
              <SubmitButton>{editing ? "บันทึก" : "เพิ่มผู้ใช้"}</SubmitButton>
              {editing && (
                <Link href="/admin/users" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">
                  ยกเลิก
                </Link>
              )}
            </div>
          </ActionForm>
        </Card>

        <Card bodyClassName="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-2 pl-3 text-left font-medium sm:pl-4">ชื่อ</th>
                <th className="hidden py-2 text-left font-medium md:table-cell">อีเมล</th>
                <th className="w-24 py-2 text-left font-medium sm:w-28">สิทธิ์</th>
                <th className="hidden w-24 py-2 text-center font-medium lg:table-cell">นัดที่ดูแล</th>
                <th className="w-24 py-2 pr-3 text-right font-medium sm:w-28 sm:pr-4">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={`border-b border-line last:border-0 hover:bg-canvas ${!u.active ? "opacity-50" : ""}`}>
                  <td className="min-w-0 py-2.5 pl-3 pr-2 sm:pl-4">
                    <span className="font-medium">{u.name}</span>
                    {u.id === session.userId && <span className="ml-2 text-xs text-muted">(คุณ)</span>}
                    <span className="block truncate text-xs text-muted md:hidden">{u.email}</span>
                    <span className="hidden text-xs text-muted md:block">เพิ่มเมื่อ {thaiDate(u.createdAt)}</span>
                  </td>
                  <td className="hidden py-2.5 text-muted md:table-cell">{u.email}</td>
                  <td className="py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "ADMIN" ? "bg-brand/10 text-brand" : "bg-canvas text-muted"}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="hidden py-2.5 text-center tnum lg:table-cell">{u._count.refereeFor}</td>
                  <td className="py-2.5 pr-3 text-right sm:pr-4">
                    <span className="inline-flex gap-1.5">
                      <Link href={`/admin/users?edit=${u.id}`} className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-surface">
                        แก้ไข
                      </Link>
                      {u.id !== session.userId && (
                        <form action={deleteUserAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <SubmitButton variant="ghost" className="!px-2.5 !py-1 !text-xs" confirm={`ลบบัญชี ${u.name}?`}>
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
        </Card>
      </div>
    </div>
  );
}
