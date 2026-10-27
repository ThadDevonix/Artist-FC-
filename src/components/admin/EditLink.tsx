"use client";

import Link, { useLinkStatus } from "next/link";
import { EDIT_FORM_ID } from "@/components/admin/editing";

/**
 * ปุ่ม "แก้ไข" ในตาราง — แสดงชัดว่าแถวไหนกำลังถูกแก้ไขอยู่ และขึ้นวงหมุนทันทีที่กด
 * ไม่ต้องรอหน้าโหลดเสร็จ ผู้ใช้จะได้ไม่กดซ้ำหรือสงสัยว่ากดติดหรือยัง
 */
export function EditLink({ href, active }: { href: string; active: boolean }) {
  return (
    <Link
      href={`${href}#${EDIT_FORM_ID}`}
      aria-current={active ? "true" : undefined}
      className={`inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
        active ? "border-brand bg-brand text-white" : "border-line hover:border-brand hover:text-brand"
      }`}
    >
      <Label active={active} />
    </Link>
  );
}

function Label({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <>
        <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        กำลังเปิด
      </>
    );
  }
  return <>{active ? "กำลังแก้ไข" : "แก้ไข"}</>;
}
