import { Logo } from "@/components/Logo";

// หน้าจอโหลดระหว่างเปลี่ยนหน้า — โลโก้อยู่กลางวงแหวนหมุน
export function PageLoader() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="relative flex size-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-4 border-line" aria-hidden />
        <span
          className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand"
          aria-hidden
        />
        <Logo size={56} className="animate-pulse" />
      </div>
      <p className="text-sm text-muted">กำลังโหลด…</p>
    </div>
  );
}
