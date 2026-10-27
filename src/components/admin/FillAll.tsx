"use client";

import { useState } from "react";
import { inputClass } from "@/components/admin/Form";

/**
 * ตั้งวันหรือเวลาเดียวกันให้ทุกคู่ในตารางทีเดียว — แล้วค่อยแก้เฉพาะคู่ที่ต่าง
 * กรอกช่องที่ data-fill ตรงกันในฟอร์มเดียวกัน
 */
export function FillAll() {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  function apply(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    if (date) form.querySelectorAll<HTMLInputElement>('input[data-fill="date"]').forEach((i) => (i.value = date));
    if (time) form.querySelectorAll<HTMLInputElement>('input[data-fill="time"]').forEach((i) => (i.value = time));
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-canvas p-3">
      <label className="text-xs text-muted">
        วัน
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1 w-40`} />
      </label>
      <label className="text-xs text-muted">
        เวลา
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} mt-1 w-28`} />
      </label>
      <button
        type="button"
        onClick={apply}
        disabled={!date && !time}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:border-ink disabled:opacity-40"
      >
        ใช้กับทุกคู่ในนัดนี้
      </button>
      <span className="text-xs text-muted">แล้วค่อยแก้เฉพาะคู่ที่แข่งวัน/เวลาอื่น</span>
    </div>
  );
}
