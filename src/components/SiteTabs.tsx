"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "ภาพรวม" },
  { href: "/fixtures", label: "การแข่งขัน" },
  { href: "/standings", label: "ตารางคะแนน" },
  { href: "/stats", label: "สถิติ" },
  { href: "/players", label: "ผู้เล่น" },
];

export function SiteTabs() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="หมวดหมู่"
      className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted hover:border-brand hover:text-brand"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
