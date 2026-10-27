"use client";

import { useFormStatus } from "react-dom";

const WARN_AFTER_MS = 60 * 60 * 1000; // ห่างจากเวลาที่แจ้งไว้เกิน 1 ชม. → ถามยืนยัน กันกดผิดนัด

/** ปุ่มเริ่มถ่ายทอดสด — ถ้ากดห่างจากเวลาเตะที่แจ้งไว้มาก จะถามยืนยันก่อน */
export function StartLiveButton({ kickoffAt, label }: { kickoffAt: string | null; label: string }) {
  const { pending } = useFormStatus();

  function confirmIfFar(e: React.MouseEvent<HTMLButtonElement>) {
    if (!kickoffAt) return; // ยังไม่ได้ตั้งวันเวลา — ไม่มีเวลาให้เทียบ
    const scheduled = new Date(kickoffAt);
    const diff = Date.now() - scheduled.getTime();
    if (Math.abs(diff) <= WARN_AFTER_MS) return;

    const time = scheduled.toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const hours = Math.round(Math.abs(diff) / WARN_AFTER_MS);
    const when = diff > 0 ? `เลยเวลามาแล้วประมาณ ${hours} ชม.` : `ยังเหลืออีกประมาณ ${hours} ชม. ก่อนถึงเวลา`;
    const ok = window.confirm(
      `${label}\nนัดนี้แจ้งเวลาเตะไว้ ${time} (${when})\n\nแน่ใจไหมว่าจะเริ่มถ่ายทอดสดนัดนี้ตอนนี้?`,
    );
    if (!ok) e.preventDefault();
  }

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={confirmIfFar}
      className="w-full rounded-lg bg-loss px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "กำลังเริ่ม…" : "● เริ่มถ่ายทอดสด"}
    </button>
  );
}
