"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ดึงข้อมูลหน้าใหม่เป็นระยะระหว่างมีนัดกำลังแข่ง — สกอร์/ตารางสดจะขยับเองโดยคนดูไม่ต้องกดรีเฟรช
 *
 * ใช้ router.refresh() ซึ่งดึงเฉพาะข้อมูลจากเซิร์ฟเวอร์มาใหม่ ไม่โหลดทั้งหน้า (สกรอลล์/ช่องที่พิมพ์ไม่หาย)
 * หยุดดึงตอนแท็บถูกซ่อน และดึงทันทีเมื่อกลับมาที่แท็บ เพื่อไม่ให้เปลืองทั้งเครื่องคนดูและเซิร์ฟเวอร์
 * intervalMs = null คือไม่มีนัดแข่ง → ไม่ดึงเลย
 */
export function LiveRefresh({ intervalMs }: { intervalMs: number | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!intervalMs) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => router.refresh(), intervalMs);
    };
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        router.refresh();
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, router]);

  return null;
}
