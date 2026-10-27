import Link from "next/link";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { PlayerPhotoInput } from "@/components/admin/PlayerPhotoInput";
import { STAFF_GROUPS, STAFF_ROLE_LABEL } from "@/lib/labels";
import { saveStaffAction } from "@/server/actions";
import type { Staff } from "@/generated/prisma/client";

/** ฟอร์มเพิ่ม/แก้ไขทีมงาน ใช้ในหน้าของทีม — ทีมล็อกเป็นทีมนี้เสมอ */
export function StaffForm({
  teamId,
  staff,
  cancelHref,
  color,
  color2,
}: {
  teamId: string;
  staff?: Staff | null;
  cancelHref: string;
  color: string;
  color2: string | null;
}) {
  return (
    <ActionForm action={saveStaffAction} className="space-y-3" key={staff?.id ?? "new"} successHref={staff ? cancelHref : undefined}>
      {staff && <input type="hidden" name="id" value={staff.id} />}
      <input type="hidden" name="teamId" value={teamId} />

      <PlayerPhotoInput name={staff?.name ?? ""} currentUrl={staff?.photoUrl ?? null} color={color} color2={color2} />

      <Field label="ชื่อ-สกุล">
        <input name="name" defaultValue={staff?.name ?? ""} required autoFocus={!!staff} className={inputClass} />
      </Field>
      <Field label="ตำแหน่ง">
        <select name="role" defaultValue={staff?.role ?? "HEAD_COACH"} className={inputClass}>
          {STAFF_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.roles.map((r) => (
                <option key={r} value={r}>{STAFF_ROLE_LABEL[r]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="ชื่อตำแหน่ง (ถ้าเลือก &quot;อื่นๆ&quot;)" hint="เช่น นักวิเคราะห์เกม, ผู้ดูแลอุปกรณ์">
        <input name="roleLabel" defaultValue={staff?.roleLabel ?? ""} className={inputClass} />
      </Field>
      <Field label="สัญชาติ">
        <input name="nationality" defaultValue={staff?.nationality ?? ""} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={staff?.active ?? true} className="size-4" />
        ยังอยู่ในทีม (แสดงบนหน้าเว็บ)
      </label>

      <div className="flex gap-2">
        <SubmitButton>{staff ? "บันทึก" : "เพิ่มทีมงาน"}</SubmitButton>
        {staff && (
          <Link href={cancelHref} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">
            ยกเลิก
          </Link>
        )}
      </div>
    </ActionForm>
  );
}
