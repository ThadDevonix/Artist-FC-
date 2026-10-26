import Link from "next/link";
import { logoutAction } from "@/server/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/Logo";
import { ThemeController } from "@/components/ThemeController";
import { requireSession } from "@/server/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireSession();
  const admin = session.role === "ADMIN";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="flex min-w-0 items-center gap-2.5 text-base font-bold">
              <Logo size={28} className="shrink-0" />
              <span className="truncate">
                Artist FC <span className="font-normal text-muted">หลังบ้าน</span>
              </span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-muted lg:block">
              {session.name}
              <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs">
                {admin ? "ผู้ดูแลระบบ" : "กรรมการ"}
              </span>
            </span>
            <Link
              href="/"
              aria-label="ดูหน้าเว็บ"
              className="inline-flex size-9 items-center justify-center rounded-full border border-line text-muted transition hover:border-brand hover:text-brand sm:size-auto sm:rounded-lg sm:border-0 sm:px-0 sm:text-sm"
            >
              <span className="hidden sm:inline">ดูหน้าเว็บ</span>
              <svg viewBox="0 0 24 24" className="size-[18px] sm:hidden" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3.5 12h17M12 3.4c2.2 2.4 3.3 5.4 3.3 8.6s-1.1 6.2-3.3 8.6c-2.2-2.4-3.3-5.4-3.3-8.6S9.8 5.8 12 3.4z" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </Link>
            <ThemeController />
            <form action={logoutAction}>
              <button
                aria-label="ออกจากระบบ"
                className="inline-flex size-9 items-center justify-center rounded-full border border-line text-muted transition hover:border-loss hover:text-loss sm:size-auto sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm sm:text-ink"
              >
                <span className="hidden sm:inline">ออกจากระบบ</span>
                <svg viewBox="0 0 24 24" className="size-[18px] sm:hidden" fill="none" aria-hidden>
                  <path d="M15 8V5.8A1.8 1.8 0 0013.2 4H5.8A1.8 1.8 0 004 5.8v12.4A1.8 1.8 0 005.8 20h7.4a1.8 1.8 0 001.8-1.8V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M9.5 12H20m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-6">
          <AdminNav isAdmin={admin} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
