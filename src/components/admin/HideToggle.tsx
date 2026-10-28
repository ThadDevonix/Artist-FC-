"use client";

import { useFormStatus } from "react-dom";

/**
 * ปุ่มรูปตาในตารางนักเตะ/ทีมงาน — ตาเปิด = แสดงบนหน้าเว็บอยู่, ตาขีดฆ่า = ซ่อนอยู่
 * ต้องวางไว้ใน <form> เพราะใช้สถานะการส่งฟอร์มเพื่อหมุนระหว่างบันทึก
 */
export function HideToggle({ hidden, name }: { hidden: boolean; name: string }) {
  const { pending } = useFormStatus();
  const label = hidden ? `แสดง ${name} บนหน้าเว็บ` : `ซ่อน ${name} จากหน้าเว็บ`;
  return (
    <button
      type="submit"
      disabled={pending}
      title={label}
      aria-label={label}
      aria-pressed={hidden}
      className={`inline-flex size-7 items-center justify-center rounded-lg border transition disabled:opacity-50 ${
        hidden ? "border-loss/40 text-loss hover:bg-canvas" : "border-line text-muted hover:border-brand hover:text-brand"
      }`}
    >
      {pending ? (
        <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          {hidden && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
        </svg>
      )}
    </button>
  );
}
