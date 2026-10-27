"use client";

import { useEffect, useRef } from "react";

/**
 * ปุ่มที่เปิดหน้าต่างป๊อปอัพ (ใช้ <dialog> ของเบราว์เซอร์ — กด Esc / คลิกพื้นหลังเพื่อปิดได้)
 * เนื้อหาข้างในส่งมาเป็น children จึงใส่ server component (เช่นฟอร์ม) ได้
 */
export function Modal({
  title,
  trigger,
  triggerClassName = "",
  defaultOpen = false,
  children,
}: {
  title: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (defaultOpen) ref.current?.showModal();
  }, [defaultOpen]);

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={triggerClassName}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        // คลิกที่พื้นหลังมืด (นอกกล่อง) = ปิด
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/60"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="ปิด"
            className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}
