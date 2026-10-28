"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SeasonSelect({
  seasons,
  current,
}: {
  seasons: { slug: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (seasons.length === 0) return null;

  return (
    <label className="block rounded-xl bg-canvas px-4 py-3">
      <span className="block text-xs text-muted">ฤดูกาล</span>
      <select
        value={current}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("season", e.target.value);
          router.push(`${pathname}?${next}`);
        }}
        className="mt-0.5 w-full cursor-pointer bg-transparent text-base font-semibold outline-none [--chevron-inset:0px]"
      >
        {seasons.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
