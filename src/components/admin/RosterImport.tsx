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
  const [dragging, setDragging] = useState(false);
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
        คอลัมน์ตามลำดับ: <span className="font-medium text-ink">{ROSTER_COLUMNS.join(" | ")}</span> — ต้องมีแค่ชื่อ
        ที่เหลือเว้นว่างได้
      </p>
      <p className="text-xs text-muted">
        ตำแหน่ง: GK / DF / MF / FW หรือพิมพ์ภาษาไทย (กองหน้า ฯลฯ) · วันเกิด: 1998-05-12 หรือ 12/05/2541
      </p>

      {/* กดเลือกหรือลากไฟล์มาวางก็ได้ */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
          dragging ? "border-brand bg-brand-soft" : "border-brand/50 hover:border-brand hover:bg-brand-soft"
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-8 text-brand" fill="none" aria-hidden>
          <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">เลือกไฟล์ CSV</span>
        <span className="text-xs text-muted">หรือลากไฟล์มาวางตรงนี้</span>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          className="sr-only"
          onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      </label>

      <button
        type="button"
        onClick={downloadTemplate}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
          <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        ดาวน์โหลดไฟล์ตัวอย่าง
      </button>

      <p className="text-center text-xs text-muted">— หรือพิมพ์ / ก๊อปตารางจาก Excel มาวางด้านล่าง —</p>
      <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
        พิมพ์เองได้ บรรทัดละ 1 คน เว้นวรรคคั่น: <span className="font-mono text-ink">ชื่อ เบอร์ ตำแหน่ง</span>
        <br />
        เช่น <span className="font-mono text-ink">สมศักดิ์ ใจดี 10 FW</span>
      </p>

      <textarea
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"สมศักดิ์ ใจดี 10 FW\nวิชัย มือหนึ่ง 1 GK\nทัด 7 กองกลาง"}
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
