import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PlayerAvatar, TeamBadge } from "@/components/ui";
import { SubmitButton, inputClass } from "@/components/admin/Form";
import { TeamForm } from "@/components/admin/TeamForm";
import { requireRole } from "@/server/auth";
import { listPlayersForAdmin, listTeamsWithPlayerCount } from "@/server/queries";

export const metadata = { title: "สโมสร/นักเตะ" };

export default async function TeamsPage({ searchParams }: PageProps<"/admin/teams">) {
  await requireRole("ADMIN");
  const sp = await searchParams;

  // ลิงก์แบบเดิม /admin/teams?edit=… ย้ายไปอยู่หน้าของทีมแล้ว
  if (typeof sp.edit === "string") redirect(`/admin/teams/${sp.edit}`);

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const [teams, found] = await Promise.all([
    listTeamsWithPlayerCount(),
    q ? listPlayersForAdmin({ search: q }, 50) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สโมสร/นักเตะ</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="space-y-4">
          {/* ค้นหานักเตะข้ามทุกทีม — เผื่อจำชื่อได้แต่จำไม่ได้ว่าอยู่ทีมไหน */}
          <form action="/admin/teams" className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="ค้นหาชื่อนักเตะทุกทีม" className={inputClass} />
            <SubmitButton variant="ghost">ค้นหา</SubmitButton>
          </form>

          {found && (
            <Card title={`ผลค้นหา "${q}"`} bodyClassName="pb-2">
              {found.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted">ไม่พบนักเตะ</p>
              ) : (
                <ul>
                  {found.map((p) => (
                    <li key={p.id} className="border-b border-line last:border-0">
                      <Link
                        href={`/admin/teams/${p.teamId}?player=${p.id}`}
                        className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-canvas sm:px-5 ${!p.active ? "opacity-50" : ""}`}
                      >
                        <span className="w-6 text-center text-muted tnum">{p.number ?? "—"}</span>
                        <PlayerAvatar name={p.name} photoUrl={p.photoUrl} color={p.team.color} color2={p.team.color2} size={28} />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-muted">
                          <TeamBadge name={p.team.name} logoUrl={p.team.logoUrl} color={p.team.color} color2={p.team.color2} size={18} />
                          {p.team.shortName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="px-4 pt-2 text-right text-xs sm:px-5">
                <Link href="/admin/teams" className="text-muted hover:text-ink">ล้างการค้นหา</Link>
              </p>
            </Card>
          )}

          <Card bodyClassName="overflow-x-auto">
            {teams.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีสโมสร เริ่มจากเพิ่มสโมสรด้านข้าง</p>
            ) : (
              <ul>
                {teams.map((t) => (
                  <li key={t.id} className="border-b border-line last:border-0">
                    <Link href={`/admin/teams/${t.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-canvas sm:px-4">
                      <TeamBadge name={t.name} code={t.code} logoUrl={t.logoUrl} color={t.color} color2={t.color2} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {t.code} · {t.city ?? "—"}
                          <span className="md:hidden"> · นักเตะ {t._count.players} คน</span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-sm text-muted md:block">{t.venue ?? "—"}</span>
                      <span className="hidden w-24 shrink-0 text-right text-sm md:block">
                        <span className="tnum font-medium">{t._count.players}</span> <span className="text-muted">คน</span>
                      </span>
                      <span aria-hidden className="shrink-0 text-muted">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="เพิ่มสโมสร" bodyClassName="px-4 pb-5 sm:px-5">
          <TeamForm />
        </Card>
      </div>
    </div>
  );
}
