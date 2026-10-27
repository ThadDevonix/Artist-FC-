import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { saveTeamAction } from "@/server/actions";
import type { Team } from "@/generated/prisma/client";

/** ฟอร์มเพิ่ม/แก้ไขสโมสร — ไม่ส่ง team มา = เพิ่มใหม่ */
export function TeamForm({ team }: { team?: Team | null }) {
  return (
    <ActionForm action={saveTeamAction} className="space-y-3" key={team?.id ?? "new"}>
      {team && <input type="hidden" name="id" value={team.id} />}

      <Field label="ชื่อสโมสร">
        <input name="name" defaultValue={team?.name ?? ""} required className={inputClass} placeholder="เช่น ลูกทุ่ง ยูไนเต็ด" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ชื่อย่อ" hint="ใช้ในตารางคะแนน">
          <input name="shortName" defaultValue={team?.shortName ?? ""} className={inputClass} placeholder="ลูกทุ่ง" />
        </Field>
        <Field label="รหัส 3 ตัว">
          <input name="code" defaultValue={team?.code ?? ""} maxLength={4} className={inputClass} placeholder="LTU" />
        </Field>
      </div>
      <Field label="URL โลโก้" hint="เว้นว่างได้ ระบบจะใช้วงกลมสีประจำทีมแทน">
        <input name="logoUrl" defaultValue={team?.logoUrl ?? ""} className={inputClass} placeholder="https://…" />
      </Field>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="เมือง">
          <input name="city" defaultValue={team?.city ?? ""} className={inputClass} />
        </Field>
        <Field label="สีประจำทีม">
          <input type="color" name="color" defaultValue={team?.color ?? "#1f2937"} className="h-9 w-16 rounded-lg border border-line" />
        </Field>
      </div>
      <Field label="สีที่ 2" hint="ไม่ติ๊ก = ใช้สีเดียว · ติ๊ก = วงกลมผ่าครึ่ง บนสีหลัก ล่างสีที่ 2">
        <span className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="useColor2" defaultChecked={!!team?.color2} className="size-4 accent-brand" />
          ใช้ 2 สี
          <input type="color" name="color2" defaultValue={team?.color2 ?? "#ffffff"} className="h-9 w-16 rounded-lg border border-line" />
        </span>
      </Field>
      <Field label="สนามเหย้า">
        <input name="venue" defaultValue={team?.venue ?? ""} className={inputClass} />
      </Field>
      <Field label="ปีที่ก่อตั้ง">
        <input type="number" name="founded" defaultValue={team?.founded ?? ""} className={inputClass} />
      </Field>

      <SubmitButton>{team ? "บันทึกข้อมูลสโมสร" : "เพิ่มสโมสร"}</SubmitButton>
    </ActionForm>
  );
}
