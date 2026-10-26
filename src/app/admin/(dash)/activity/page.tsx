import { Card } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { listAuditLogs } from "@/server/queries";
import { thaiDateTime } from "@/lib/format";
import { auditLabel } from "@/lib/labels";

export const metadata = { title: "ประวัติการแก้ไข" };

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const { logs, pages } = await listAuditLogs({ page });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ประวัติการแก้ไข</h1>
        <p className="mt-1 text-sm text-muted">บันทึกทุกการเปลี่ยนแปลงในระบบ ตรวจย้อนหลังได้ว่าใครทำอะไรเมื่อไหร่</p>
      </div>

      <Card bodyClassName="overflow-x-auto">
        {logs.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted">ยังไม่มีประวัติ</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="w-32 py-2 pl-3 text-left font-medium sm:w-44 sm:pl-4">เวลา</th>
                <th className="hidden w-40 py-2 text-left font-medium sm:table-cell">ผู้ใช้</th>
                <th className="py-2 text-left font-medium">การกระทำ</th>
                <th className="hidden py-2 pr-4 text-left font-medium lg:table-cell">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-line last:border-0">
                  <td className="py-2 pl-3 align-top text-xs text-muted sm:pl-4">{thaiDateTime(log.createdAt)}</td>
                  <td className="hidden py-2 sm:table-cell">
                    {log.user?.name ?? <span className="text-muted">ระบบ</span>}
                  </td>
                  <td className="min-w-0 py-2 pr-2">
                    {auditLabel(log.action)}
                    <span className="block text-xs text-muted sm:hidden">
                      {log.user?.name ?? "ระบบ"}
                    </span>
                  </td>
                  <td className="hidden py-2 pr-4 text-xs text-muted lg:table-cell">
                    <span className="line-clamp-1">{log.detail ?? "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/activity?page=${p}`}
              className={`rounded-lg border px-3 py-1.5 ${p === page ? "border-ink bg-surface font-medium" : "border-line bg-surface text-muted"}`}
            >
              {p}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}
