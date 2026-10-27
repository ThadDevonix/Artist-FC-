"use client";

import { useActionState, useMemo, useState } from "react";
import { SubmitButton, inputClass } from "@/components/admin/Form";
import { POSITION_LABEL } from "@/lib/labels";
import {
  markDuplicateNumbers,
  parseRoster,
  rosterTemplateCsv,
  ROSTER_COLUMNS,
  ROSTER_MAX_ROWS,
} from "@/lib/roster-import";
import { importPlayersAction } from "@/server/actions";

/**
 * นำเข้านักเตะทีละหลายคน — วางจาก Excel/Google Sheets หรือเลือกไฟล์ CSV
 * แสดงตัวอย่างพร้อมบอกแถวที่ผิดก่อน แล้วค่อยกดยืนยัน (เซิร์ฟเวอร์ตรวจซ้ำอีกรอบ)
 */
export function RosterImport({ teamId, takenNumbers }: { teamId: string; takenNumbers: number[] }) {
  const [text, setText] = useState("");
  const [state, formAction] = useActionState(importPlayersAction, {});

  // นำเข้าสำเร็จแล้วล้างกล่องข้อความ (ปรับ state ระหว่าง render ตามแนวทางของ React แทน useEffect)
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setText("");
  }

  const rows = useMemo(() => markDuplicateNumbers(parseRoster(text), takenNumbers), [text, takenNumbers]);
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  const tooMany = rows.length > ROSTER_MAX_ROWS;

  async function loadFile(file: File | undefined) {
    if (file) setText(await file.text());
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([rosterTemplateCsv()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "รายชื่อนักเตะ.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="teamId" value={teamId} />

      <p className="text-sm text-muted">
        ก๊อปตารางจาก Excel / Google Sheets มาวาง หรือเลือกไฟล์ CSV · คอลัมน์ตามลำดับ:{" "}
        <span className="font-medium text-ink">{ROSTER_COLUMNS.join(" | ")}</span> — ต้องมีแค่ชื่อ ที่เหลือเว้นว่างได้
      </p>
      <p className="text-xs text-muted">
        ตำแหน่ง: GK / DF / MF / FW หรือพิมพ์ภาษาไทย (กองหน้า ฯลฯ) · วันเกิด: 1998-05-12 หรือ 12/05/2541
      </p>

      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-canvas">
          เลือกไฟล์ CSV
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="sr-only"
            onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
        <button type="button" onClick={downloadTemplate} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm hover:bg-canvas">
          ดาวน์โหลดไฟล์ตัวอย่าง
        </button>
      </div>

      <textarea
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"สมศักดิ์ ใจดี\t10\tFW\tไทย\t1998-05-12\nวิชัย มือหนึ่ง\t1\tGK"}
        className={`${inputClass} font-mono text-xs`}
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{state.ok}</p>
      )}

      {rows.length > 0 && (
        <>
          <p className="text-sm">
            พบ <b>{rows.length}</b> คน
            {errorCount > 0 ? (
              <span className="text-loss"> · ต้องแก้ {errorCount} แถวก่อนนำเข้า</span>
            ) : (
              <span className="text-win"> · พร้อมนำเข้า</span>
            )}
            {tooMany && <span className="text-loss"> · นำเข้าได้ครั้งละไม่เกิน {ROSTER_MAX_ROWS} คน</span>}
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-muted">
                  <th className="px-2 py-1.5 text-left font-medium">บรรทัด</th>
                  <th className="px-2 py-1.5 text-left font-medium">ชื่อ</th>
                  <th className="px-2 py-1.5 text-center font-medium">เบอร์</th>
                  <th className="px-2 py-1.5 text-left font-medium">ตำแหน่ง</th>
                  <th className="hidden px-2 py-1.5 text-left font-medium sm:table-cell">สัญชาติ</th>
                  <th className="hidden px-2 py-1.5 text-left font-medium sm:table-cell">วันเกิด</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={`border-b border-line last:border-0 ${r.errors.length ? "bg-red-50 dark:bg-red-950/40" : ""}`}>
                    <td className="px-2 py-1.5 text-muted tnum">{r.line}</td>
                    <td className="px-2 py-1.5">
                      {r.name || "—"}
                      {r.errors.map((e) => (
                        <span key={e} className="block text-loss">{e}</span>
                      ))}
                    </td>
                    <td className="px-2 py-1.5 text-center tnum">{r.number ?? "—"}</td>
                    <td className="px-2 py-1.5">{POSITION_LABEL[r.position]}</td>
                    <td className="hidden px-2 py-1.5 sm:table-cell">{r.nationality ?? "—"}</td>
                    <td className="hidden px-2 py-1.5 sm:table-cell tnum">{r.birthDate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rows.length > 0 && errorCount === 0 && !tooMany && (
        <SubmitButton>นำเข้า {rows.length} คน</SubmitButton>
      )}
    </form>
  );
}
