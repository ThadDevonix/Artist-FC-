import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteTabs } from "@/components/SiteTabs";
import { ThemeController } from "@/components/ThemeController";
import { getActiveSeason } from "@/server/queries";
import { getSeasonProgress } from "@/server/queries";
import { getSession } from "@/server/auth";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const season = await getActiveSeason();
  const progress = season ? await getSeasonProgress(season.id) : null;
  const session = await getSession();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            {/* แถวบนบนมือถือ: โลโก้ + ปุ่มธีม */}
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <Logo size={40} className="sm:hidden" />
                <Logo size={48} className="hidden sm:block" />
                <span className="min-w-0">
                  <span className="block truncate text-xl font-bold leading-tight tracking-tight sm:text-2xl">
                    Artist FC
                  </span>
                  <span className="block truncate text-xs text-muted sm:text-sm">
                    {progress && progress.totalRounds > 0
                      ? `นัดที่ ${progress.currentRound} จาก ${progress.totalRounds} นัด`
                      : "ยังไม่เริ่มฤดูกาล"}
                  </span>
                </span>
              </Link>

              <div className="flex shrink-0 items-center gap-2 lg:hidden">
                <ThemeController />
                <Link
                  href={session ? "/admin" : "/admin/login"}
                  aria-label={session ? "เข้าหลังบ้าน" : "เข้าสู่ระบบ"}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-line text-muted transition hover:border-brand hover:text-brand"
                >
                  <UserIcon />
                </Link>
              </div>
            </div>

            {/* แท็บ — เลื่อนแนวนอนได้เมื่อจอแคบ */}
            <div className="flex items-center gap-3 lg:shrink-0">
              <SiteTabs />
              <div className="hidden shrink-0 items-center gap-3 lg:flex">
                <ThemeController />
                <Link
                  href={session ? "/admin" : "/admin/login"}
                  className="shrink-0 rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition hover:border-brand hover:text-brand"
                >
                  {session ? "หลังบ้าน" : "เข้าสู่ระบบ"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-6 sm:py-6">
        {children}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2">
            <Logo size={20} />
            Artist FC · ฤดูกาล {season?.name ?? "—"}
          </p>
          <Link href="/admin" className="hover:text-brand">
            เข้าสู่ระบบหลังบ้าน
          </Link>
        </div>
      </footer>
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <circle cx="12" cy="8.5" r="3.7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
