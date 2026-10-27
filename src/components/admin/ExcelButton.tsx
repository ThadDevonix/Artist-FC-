/**
 * ปุ่มสีส้ม "โหลด Excel …" — ใช้ในหน้าหลังบ้านเท่านั้น (route ดาวน์โหลดตรวจสิทธิ์แอดมินอีกชั้น)
 * เป็นลิงก์ธรรมดา เบราว์เซอร์ดาวน์โหลดไฟล์เองจาก Content-Disposition
 */
export function exportHref(
  kind: "clubs" | "standings" | "matches" | "players" | "staff" | "all",
  params: { season?: string; round?: number; team?: string; scope?: "all" } = {},
) {
  const q = new URLSearchParams({ kind });
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  return `/admin/export/download?${q}`;
}

export function ExcelButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
        <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </a>
  );
}
