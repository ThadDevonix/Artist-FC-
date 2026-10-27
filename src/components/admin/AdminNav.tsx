"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ALL = [
  { href: "/admin", label: "ภาพรวม", adminOnly: false },
  { href: "/admin/matches", label: "บันทึกผลการแข่งขัน", adminOnly: false },
  { href: "/admin/seasons", label: "ฤดูกาล", adminOnly: true },
  { href: "/admin/teams", label: "สโมสร/นักเตะ", adminOnly: true },
  { href: "/admin/officials", label: "ผู้ตัดสิน", adminOnly: true },
  { href: "/admin/users", label: "ผู้ใช้งาน", adminOnly: true },
  { href: "/admin/activity", label: "ประวัติการแก้ไข", adminOnly: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ALL.filter((i) => isAdmin || !i.adminOnly);

  return (
    <nav className="no-scrollbar -mx-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      {items.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
