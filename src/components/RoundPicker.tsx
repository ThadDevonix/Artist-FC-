"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * เลือกนัดที่ (matchweek) — ช่องเลือก + ปุ่ม ‹ › ไปนัดก่อนหน้า/ถัดไป
 * แทนแถวปุ่ม "นัดที่ 1 … 38" ที่ยาวเกินจอเมื่อลีกมีหลายนัด
 * path + query คือ URL ปัจจุบันที่ไม่รวม round — เปลี่ยนนัดแล้วตัวกรองอื่นยังอยู่ครบ
 */
export function RoundPicker({
  rounds,
  current,
  path,
  query,
}: {
  rounds: { round: number; label: string }[];
  current?: number;
  path: string;
  query: string;
}) {
  const router = useRouter();
  const href = (round?: number) => {
    const q = new URLSearchParams(query);
    if (round) q.set("round", String(round));
    else q.delete("round");
    const s = q.toString();
    return `${path}${s ? `?${s}` : ""}`;
  };

  const index = rounds.findIndex((r) => r.round === current);
  const prev = index > 0 ? rounds[index - 1].round : undefined;
  const next = index >= 0 && index < rounds.length - 1 ? rounds[index + 1].round : current ? undefined : rounds[0]?.round;

  const arrow = "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-lg transition";

  return (
    <div className="flex items-center gap-2">
      {prev ? (
        <Link href={href(prev)} scroll={false} aria-label={`นัดที่ ${prev}`} className={`${arrow} hover:border-ink`}>‹</Link>
      ) : (
        <span aria-hidden className={`${arrow} text-muted opacity-40`}>‹</span>
      )}
      <select
        aria-label="เลือกนัดที่"
        value={current ?? ""}
        onChange={(e) => router.push(href(e.target.value ? Number(e.target.value) : undefined), { scroll: false })}
        className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm font-medium outline-none focus:border-ink sm:max-w-xs"
      >
        <option value="">ทุกนัด</option>
        {rounds.map((r) => (
          <option key={r.round} value={r.round}>{r.label}</option>
        ))}
      </select>
      {next ? (
        <Link href={href(next)} scroll={false} aria-label={`นัดที่ ${next}`} className={`${arrow} hover:border-ink`}>›</Link>
      ) : (
        <span aria-hidden className={`${arrow} text-muted opacity-40`}>›</span>
      )}
    </div>
  );
}
