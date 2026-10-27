import Link from "next/link";
import type { ReactNode } from "react";
import type { FormResult } from "@/lib/standings";
import { MATCH_STATUS_LABEL, MATCH_STATUS_STYLE } from "@/lib/labels";
import type { MatchStatus } from "@/generated/prisma/enums";

/** พื้นวงกลมสีทีม — มีสีที่ 2 จะผ่าครึ่งแนวนอน บนสีหลัก ล่างสีรอง */
export function teamBackground(color?: string | null, color2?: string | null) {
  const main = color ?? "#374151";
  return color2 ? `linear-gradient(180deg, ${main} 50%, ${color2} 50%)` : main;
}

/** โลโก้ทีม — ถ้าไม่มีรูปจะวาดวงกลมสีประจำทีมพร้อมตัวย่อแทน */
export function TeamBadge({
  name,
  code,
  logoUrl,
  color,
  color2,
  size = 24,
}: {
  name: string;
  code?: string;
  logoUrl?: string | null;
  color?: string;
  color2?: string | null;
  size?: number;
}) {
  if (logoUrl) {
    // โลโก้มาจาก URL ที่ผู้ดูแลกรอกเอง (โดเมนใดก็ได้) จึงใช้ <img> แทน next/image
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: teamBackground(color, color2),
        fontSize: Math.max(8, size * 0.38),
        // เงาตัวอักษรช่วยให้อ่านออกเมื่อครึ่งล่างเป็นสีอ่อน
        textShadow: color2 ? "0 1px 2px rgb(0 0 0 / 0.55)" : undefined,
      }}
    >
      {(code ?? name).slice(0, 3)}
    </span>
  );
}

/** รูปนักเตะ — ถ้าไม่มีรูปจะวาดวงกลมสีทีมพร้อมตัวอักษร (ค่าตั้งต้นคืออักษรแรกของชื่อ) */
export function PlayerAvatar({
  name,
  photoUrl,
  color,
  color2,
  label,
  size = 32,
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  color?: string | null;
  color2?: string | null;
  label?: string | number | null;
  size?: number;
  className?: string;
}) {
  if (photoUrl) {
    // รูปมาจาก URL ที่ผู้ดูแลกรอกเอง (โดเมนใดก็ได้) จึงใช้ <img> แทน next/image
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className={`shrink-0 rounded-full bg-canvas object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: teamBackground(color, color2),
        fontSize: Math.max(10, size * 0.4),
        textShadow: color2 ? "0 1px 2px rgb(0 0 0 / 0.55)" : undefined,
      }}
    >
      {/* ข้ามสระหน้า (เ แ โ ใ ไ) ไม่งั้น "เพชร" จะได้แค่ "เ" */}
      {label ?? name.replace(/^[เแโใไ]/, "").slice(0, 1)}
    </span>
  );
}

/** ปุ่มย้อนกลับ — ทรงเม็ดยา มีลูกศร ใช้แบบเดียวกันทุกหน้า */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pl-2.5 pr-4 text-sm font-medium text-muted shadow-sm transition hover:border-ink hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </Link>
  );
}

/** หัวการ์ดตอนกำลังแก้ไข — บอกชัดว่ากำลังแก้ใครอยู่ */
export function EditingTitle({ label, name }: { label: string; name: string }) {
  return (
    <h2 className="min-w-0 text-lg font-semibold">
      {label}
      <span className="mt-1 block truncate rounded-lg bg-brand-soft px-2.5 py-1 text-sm font-medium text-brand">{name}</span>
    </h2>
  );
}

/** จุดแสดงผล 5 นัดล่าสุด — เขียว ชนะ / เทา เสมอ / แดง แพ้ */
export function FormDots({
  form,
  size = 20,
}: {
  form: { result: FormResult; matchId: string }[];
  size?: number;
}) {
  const label: Record<FormResult, string> = { W: "ชนะ", D: "เสมอ", L: "แพ้" };
  const bg: Record<FormResult, string> = {
    W: "bg-win",
    D: "bg-draw",
    L: "bg-loss",
  };

  if (form.length === 0) {
    return <span className="text-xs text-muted">—</span>;
  }

  return (
    <span className="flex items-center gap-1">
      {form.map((f, i) => (
        <Link
          key={`${f.matchId}-${i}`}
          href={`/matches/${f.matchId}`}
          title={label[f.result]}
          className={`inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white transition hover:opacity-80 ${bg[f.result]}`}
          style={{ width: size, height: size }}
        >
          <span className="sr-only">{label[f.result]}</span>
          <span aria-hidden>{f.result === "W" ? "✓" : f.result === "L" ? "✕" : "–"}</span>
        </Link>
      ))}
    </span>
  );
}

export function Card({
  id,
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  id?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-line bg-surface ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
          {typeof title === "string" ? (
            <h2 className="text-lg font-semibold">{title}</h2>
          ) : (
            title
          )}
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-sm text-muted">{children}</p>
  );
}

/** ป้าย LIVE จุดแดงกะพริบ — ใช้ทุกที่ที่มีนัดกำลังแข่ง */
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white ${className}`}>
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      LIVE
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  if (status === "LIVE") return <LiveBadge />;
  const key = status as MatchStatus;
  const label = MATCH_STATUS_LABEL[key] ?? status;
  const cls = MATCH_STATUS_STYLE[key] ?? "bg-canvas text-muted";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ป้ายตำแหน่งอยู่ที่ src/lib/labels.ts — re-export ไว้เพื่อให้หน้าเดิมยัง import ที่เดิมได้
export { POSITION_LABEL } from "@/lib/labels";

export const POSITION_SHORT: Record<string, string> = {
  GK: "GK",
  DF: "DF",
  MF: "MF",
  FW: "FW",
};
