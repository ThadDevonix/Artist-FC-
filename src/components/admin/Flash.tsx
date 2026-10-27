"use client";

import { useEffect, useState } from "react";

export const FLASH_EVENT = "artistfc:flash";

/** แจ้งผลด้วยป้ายมุมจอ — เรียกได้จากทุกที่ในหลังบ้าน */
export function showFlash(message: string) {
  window.dispatchEvent(new CustomEvent<string>(FLASH_EVENT, { detail: message }));
}

/**
 * ป้ายแจ้งผลมุมล่างจอ (เช่น "บันทึกข้อมูลแล้ว") — ใช้หลังบันทึกแล้วพาออกจากโหมดแก้ไข
 * อยู่ใน layout หลังบ้านซึ่งไม่ถูกสร้างใหม่ตอนเปลี่ยนหน้า จึงรับข้อความผ่าน event ได้ตรง ๆ
 */
export function Flash() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFlash = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 3000);
    };
    window.addEventListener(FLASH_EVENT, onFlash);
    return () => {
      window.removeEventListener(FLASH_EVENT, onFlash);
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-5 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full bg-win px-5 py-2.5 text-sm font-medium text-white shadow-lg"
    >
      <span aria-hidden>✓</span>
      {message}
    </div>
  );
}
