"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** เลือกฤดูกาลแบบดรอปดาวน์ — มีหลายฤดูกาลก็ไม่ล้นหัวหน้า · ฤดูกาลที่ใช้งานอยู่มีป้ายต่อท้าย */
export function SeasonPicker({
  seasons,
  current,
}: {
  seasons: { slug: string; name: string; isActive: boolean }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <select
      value={current}
      aria-label="ฤดูกาล"
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("season", e.target.value);
        router.push(`${pathname}?${next}`);
      }}
      className="w-auto max-w-full cursor-pointer rounded-full border border-ink bg-surface py-1.5 pr-8 pl-3 text-sm font-medium outline-none"
    >
      {seasons.map((s) => (
        <option key={s.slug} value={s.slug}>
          {s.name}
          {s.isActive ? " (ใช้งานอยู่)" : ""}
        </option>
      ))}
    </select>
  );
}
