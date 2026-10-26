"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type State = { error?: string; ok?: string };

/** ปุ่มที่ปิดตัวเองระหว่างส่งฟอร์ม กันกดซ้ำ */
export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  confirm,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand text-white hover:opacity-90",
    ghost: "border border-line bg-surface text-ink hover:bg-canvas",
    danger: "bg-loss text-white hover:opacity-90",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
    >
      {pending ? "กำลังบันทึก…" : children}
    </button>
  );
}

/** ฟอร์มที่แสดงข้อความสำเร็จ/ผิดพลาดจาก server action ให้เอง */
export function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p>
      )}
      {state.ok && (
        <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{state.ok}</p>
      )}
      {children}
    </form>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink";
