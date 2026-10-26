"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  isThemePreference,
  resolveTheme,
  themeByThaiTime,
  themeLabel,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

// ── ที่เก็บค่าที่ผู้ใช้เลือกไว้ อ่านจาก localStorage ──────────────────────────
// ใช้ useSyncExternalStore เพราะ localStorage อยู่นอก React
// ฝั่งเซิร์ฟเวอร์จะได้ "auto" เสมอ แล้วค่อยอัปเดตหลัง hydrate

const listeners = new Set<() => void>();
let cached: ThemePreference | null = null;

function read(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(saved) ? saved : "auto";
  } catch {
    return "auto"; // เบราว์เซอร์บล็อก storage ก็ให้ใช้ตามเวลาไทยไป
  }
}

function getSnapshot(): ThemePreference {
  if (cached === null) cached = read();
  return cached;
}

function getServerSnapshot(): ThemePreference {
  return "auto";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    cached = read();
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: ThemePreference) {
  cached = next;
  try {
    if (next === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // ใช้ต่อได้ แค่จำค่าไม่ได้
  }
  listeners.forEach((l) => l());
}

function apply(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}

/**
 * ปุ่มสลับธีม — ค่าเริ่มต้นคือ "ตามเวลาไทย"
 * กดวนได้: ตามเวลาไทย → สว่าง → มืด → ตามเวลาไทย
 *
 * เซิร์ฟเวอร์ตั้ง data-theme มาให้ตั้งแต่ HTML แรกแล้ว ปุ่มนี้แค่เปลี่ยนทีหลัง
 * จึงไม่มีอาการจอขาววาบตอนเปิดหน้าในโหมดมืด
 */
export function ThemeController() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    apply(resolveTheme(preference));

    // อยู่หน้าเดิมข้ามหกโมงเช้า/หกโมงเย็น ก็ต้องเปลี่ยนตาม
    if (preference !== "auto") return;
    const timer = setInterval(() => apply(themeByThaiTime()), 60_000);
    return () => clearInterval(timer);
  }, [preference]);

  const label = themeLabel(preference);
  const next: ThemePreference =
    preference === "auto" ? "light" : preference === "light" ? "dark" : "auto";

  return (
    <button
      type="button"
      onClick={() => write(next)}
      title={label}
      aria-label={`เปลี่ยนธีม — ${label}`}
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-brand hover:text-brand"
    >
      {preference === "auto" ? <ClockIcon /> : preference === "light" ? <SunIcon /> : <MoonIcon />}
      {preference === "auto" && (
        <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand" />
      )}
    </button>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M4.2 12H1.8M22.2 12h-2.4M6.3 6.3L4.6 4.6M19.4 19.4l-1.7-1.7M17.7 6.3l1.7-1.7M4.6 19.4l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <path
        d="M20 14.2A8.2 8.2 0 019.8 4a8.4 8.4 0 102 10.2 8.2 8.2 0 008.2 0z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
