import Link from "next/link";
import { ActionForm, Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { POSITION_LABEL } from "@/components/ui";
import { POSITIONS } from "@/lib/labels";
import { savePlayerAction } from "@/server/actions";
import type { Player } from "@/generated/prisma/client";

/**
 * ฟอร์มเพิ่ม/แก้ไขนักเตะ ใช้ในหน้าของทีม
 * เพิ่มใหม่ = ทีมล็อกเป็นทีมนี้ · แก้ไข = เลือกย้ายทีมได้
 */
export function PlayerForm({
  teamId,
  player,
  teams,
  cancelHref,
}: {
  teamId: string;
  player?: Player | null;
  teams: { id: string; name: string }[];
  cancelHref: string;
}) {
  return (
    <ActionForm action={savePlayerAction} className="space-y-3" key={player?.id ?? "new"}>
      {player && <input type="hidden" name="id" value={player.id} />}

      <Field label="ชื่อ-สกุล">
        <input name="name" defaultValue={player?.name ?? ""} required autoFocus={!!player} className={inputClass} />
      </Field>
      {player ? (
        <Field label="สังกัดทีม" hint="เปลี่ยนเพื่อย้ายนักเตะไปทีมอื่น">
          <select name="teamId" defaultValue={player.teamId} className={inputClass}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="teamId" value={teamId} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="เบอร์เสื้อ">
          <input type="number" name="number" min={1} max={99} defaultValue={player?.number ?? ""} className={inputClass} />
        </Field>
        <Field label="ตำแหน่ง">
          <select name="position" defaultValue={player?.position ?? "MF"} className={inputClass}>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{POSITION_LABEL[p]}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="สัญชาติ">
          <input name="nationality" defaultValue={player?.nationality ?? ""} className={inputClass} />
        </Field>
        <Field label="วันเกิด">
          <input type="date" name="birthDate" defaultValue={player?.birthDate?.toISOString().slice(0, 10) ?? ""} className={inputClass} />
        </Field>
      </div>
      <Field label="URL รูปภาพ">
        <input name="photoUrl" defaultValue={player?.photoUrl ?? ""} className={inputClass} placeholder="https://…" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={player?.active ?? true} className="size-4" />
        ยังอยู่ในทีม (แสดงบนหน้าเว็บ)
      </label>

      <div className="flex gap-2">
        <SubmitButton>{player ? "บันทึก" : "เพิ่มนักเตะ"}</SubmitButton>
        {player && (
          <Link href={cancelHref} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-canvas">
            ยกเลิก
          </Link>
        )}
      </div>
    </ActionForm>
  );
}
