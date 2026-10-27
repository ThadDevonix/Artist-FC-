"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { inputClass } from "@/components/admin/Form";

/**
 * ช่องพิมพ์ชื่อเพื่อยืนยันการลบ — ปุ่มกดได้ก็ต่อเมื่อพิมพ์ตรงทุกตัวอักษร
 * ใช้กับการลบที่ย้อนกลับไม่ได้ (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น)
 */
export function TypeToConfirm({ expected, label }: { expected: string; label: string }) {
  const [typed, setTyped] = useState("");
  const { pending } = useFormStatus();
  const matches = typed.trim() === expected;

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        พิมพ์ <span className="rounded bg-canvas px-1.5 py-0.5 font-mono font-semibold text-ink">{expected}</span> เพื่อยืนยัน
        <input
          name="confirmName"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className={`${inputClass} mt-1`}
          placeholder={expected}
        />
      </label>
      <button
        type="submit"
        disabled={!matches || pending}
        className="rounded-lg bg-loss px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "กำลังลบ…" : label}
      </button>
    </div>
  );
}
