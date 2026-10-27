"use client";

import { useState } from "react";
import { inputClass } from "@/components/admin/Form";

/**
 * ช่องรหัสผ่านในฟอร์มผู้ใช้
 * เพิ่มผู้ใช้ = ช่องกรอกปกติ · แก้ไขผู้ใช้ = โชว์ว่า "ตั้งไว้แล้ว" กดปุ่มก่อนถึงจะเปลี่ยนได้
 *
 * รหัสเดิมแสดงไม่ได้ เพราะระบบเก็บแค่ค่าที่เข้ารหัสทางเดียว (bcrypt) ไม่ได้เก็บรหัสจริง
 * ไม่กดเปลี่ยน = ไม่ส่งช่อง password ไป → เซิร์ฟเวอร์คงรหัสเดิมไว้
 */
export function PasswordField({ editing }: { editing: boolean }) {
  const [changing, setChanging] = useState(false);

  if (!editing || changing) {
    return (
      <div>
        <span className="mb-1 flex items-center justify-between text-sm font-medium">
          {editing ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
          {editing && (
            <button type="button" onClick={() => setChanging(false)} className="text-xs font-normal text-muted hover:text-ink">
              ยกเลิก ใช้รหัสเดิม
            </button>
          )}
        </span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required={!editing}
          minLength={8}
          autoFocus={editing}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-muted">อย่างน้อย 8 ตัวอักษร</span>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">รหัสผ่าน</span>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-3 py-2">
        <span className="flex items-center gap-2 text-sm">
          <span aria-hidden className="tracking-widest text-muted">●●●●●●●●</span>
          <span className="text-xs font-medium text-win">ตั้งไว้แล้ว</span>
        </span>
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="shrink-0 rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-medium transition hover:border-ink"
        >
          เปลี่ยนรหัสผ่าน
        </button>
      </div>
      <span className="mt-1 block text-xs text-muted">ดูรหัสเดิมไม่ได้ (ระบบเก็บแบบเข้ารหัส) — ลืมรหัส ให้ตั้งใหม่แทน</span>
    </div>
  );
}
