import Link from "next/link";
import type { ReactNode } from "react";
import type { FormResult } from "@/lib/standings";
import { MATCH_STATUS_LABEL, MATCH_STATUS_STYLE } from "@/lib/labels";
import type { MatchStatus } from "@/generated/prisma/enums";

/** โลโก้ทีม — ถ้าไม่มีรูปจะวาดวงกลมสีประจำทีมพร้อมตัวย่อแทน */
export function TeamBadge({
  name,
  code,
  logoUrl,
  color,
  size = 24,
}: {
  name: string;
  code?: string;
  logoUrl?: string | null;
  color?: string;
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
        background: color ?? "#374151",
        fontSize: Math.max(8, size * 0.38),
      }}
    >
      {(code ?? name).slice(0, 3)}
    </span>
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
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
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

export function StatusPill({ status }: { status: string }) {
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
