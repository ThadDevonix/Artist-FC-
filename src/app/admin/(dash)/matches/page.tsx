import Link from "next/link";
import { Card, StatusPill, TeamBadge } from "@/components/ui";
import { requireSession } from "@/server/auth";
import { getSeasonBySlug, listMatchesForAdmin, listRoundOptions, listSeasons } from "@/server/queries";
import { RoundPicker } from "@/components/RoundPicker";
import { thaiDateTime } from "@/lib/format";
import { MATCH_STATUS_LABEL } from "@/lib/labels";
import { matchStatusEnum, parseEnumParam } from "@/server/validation";
import type { MatchStatus } from "@/generated/prisma/enums";

export const metadata = { title: "บันทึกผลการแข่งขัน" };

/** ปุ่มของแต่ละนัด — ยังไม่เริ่มแข่ง = เริ่ม (สีส้ม) · เริ่มไปแล้วหรือจบแล้ว = แก้ไข · ยังมีช่องทีมว่าง = รอใส่สโมสร (สีเทา) */
type Row = { status: string; homeTeam: { isPlaceholder: boolean }; awayTeam: { isPlaceholder: boolean } };
const unfilled = (m: Row) => m.homeTeam.isPlaceholder || m.awayTeam.isPlaceholder;
const notStarted = (m: Row) => m.status === "SCHEDULED" || m.status === "POSTPONED";
const actionLabel = (m: Row) => (unfilled(m) ? "รอใส่สโมสร" : notStarted(m) ? "เริ่มการแข่งขัน" : "แก้ไขการแข่งขัน");

/** สถานะที่ให้กรองได้บนหน้านี้ (ไม่รวม CANCELLED ที่ใช้น้อย) */
const FILTERABLE: MatchStatus[] = ["SCHEDULED", "LIVE", "PENDING", "FINISHED", "POSTPONED"];

export default async function AdminMatchesPage({ searchParams }: PageProps<"/admin/matches">) {
  const sp = await searchParams;
  const session = await requireSession();
  const admin = session.role === "ADMIN";

  const seasons = await listSeasons();
  const season = await getSeasonBySlug(typeof sp.season === "string" ? sp.season : undefined);
  if (!season) return <p className="py-10 text-center text-muted">ยังไม่มีฤดูกาล</p>;

  const status = parseEnumParam(matchStatusEnum, sp.status);
  const round = typeof sp.round === "string" ? Number(sp.round) : undefined;
  const mine = sp.mine === "1" || !admin;

  const rounds = await listRoundOptions(season.id);

  const matches = await listMatchesForAdmin(season.id, {
    status,
    round,
    ...(mine ? { officialUserId: session.userId } : {}),
  });

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (season.slug !== seasons[0]?.slug) q.set("season", season.slug);
    if (status) q.set("status", status);
    if (round) q.set("round", String(round));
    if (mine && admin) q.set("mine", "1");
    for (const [k, v] of Object.entries(patch)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    const s = q.toString();
    return `/admin/matches${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">บันทึกผลการแข่งขัน</h1>
        {!admin && (
          <p className="text-sm text-muted">แสดงเฉพาะนัดที่คุณเป็นผู้ตัดสิน</p>
        )}
        {admin && (
          <Link
            href={`/admin/schedule${round ? `?round=${round}` : ""}`}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
              <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            จัดวันเวลาแข่ง
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip href={link({ status: undefined })} active={!status}>ทุกสถานะ</Chip>
        {FILTERABLE.map((s) => (
          <Chip key={s} href={link({ status: s })} active={status === s}>
            {MATCH_STATUS_LABEL[s]}
          </Chip>
        ))}
        {admin && (
          <Chip href={link({ mine: mine ? undefined : "1" })} active={mine}>
            เฉพาะนัดของฉัน
          </Chip>
        )}
      </div>

      <RoundPicker
        rounds={rounds}
        current={round}
        path="/admin/matches"
        query={link({ round: undefined }).split("?")[1] ?? ""}
      />

      {matches.length === 0 ? (
        <Card>
          <p className="px-4 py-12 text-center text-sm text-muted">ไม่มีนัดตามเงื่อนไขที่เลือก</p>
        </Card>
      ) : (
        <>
          {/* มือถือ: การ์ดกดง่ายด้วยนิ้ว */}
          <ul className="space-y-2 md:hidden">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/matches/${m.id}`}
                  className="block rounded-2xl border border-line bg-surface p-3 transition active:bg-canvas"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>นัดที่ {m.round} · {thaiDateTime(m.kickoffAt)}</span>
                    <StatusPill status={m.status} />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-sm font-medium">
                      <span className="truncate">{m.homeTeam.shortName}</span>
                      <TeamBadge name={m.homeTeam.name} logoUrl={m.homeTeam.logoUrl} color={m.homeTeam.color} color2={m.homeTeam.color2} size={22} />
                    </span>
                    <span className="w-14 shrink-0 text-center">
                      {m.homeGoals !== null ? (
                        <span className="rounded-md bg-canvas px-2 py-1 text-sm font-bold tnum">
                          {m.homeGoals}–{m.awayGoals}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">พบ</span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                      <TeamBadge name={m.awayTeam.name} logoUrl={m.awayTeam.logoUrl} color={m.awayTeam.color} color2={m.awayTeam.color2} size={22} />
                      <span className="truncate">{m.awayTeam.shortName}</span>
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-xs">
                    <span className="truncate text-muted">
                      ผู้ตัดสิน {m.referee?.name ?? "—"}
                    </span>
                    <span className={`shrink-0 font-medium ${unfilled(m) ? "text-muted" : notStarted(m) ? "text-brand" : "text-ink"}`}>
                      {actionLabel(m)}{!unfilled(m) && " →"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* จอกว้าง: ตารางเห็นภาพรวมได้เยอะกว่า */}
          <Card className="hidden md:block" bodyClassName="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="w-14 py-2 pl-4 text-left font-medium">นัดที่</th>
                  <th className="py-2 text-left font-medium">คู่แข่งขัน</th>
                  <th className="w-20 py-2 text-center font-medium">สกอร์</th>
                  <th className="w-36 py-2 text-left font-medium">วันเวลา</th>
                  <th className="hidden w-28 py-2 text-left font-medium lg:table-cell">ผู้ตัดสิน</th>
                  <th className="w-24 py-2 text-left font-medium">สถานะ</th>
                  <th className="w-36 py-2 pr-4 text-right font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="py-2.5 pl-4 tnum text-muted">{m.round}</td>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2">
                        <TeamBadge name={m.homeTeam.name} logoUrl={m.homeTeam.logoUrl} color={m.homeTeam.color} color2={m.homeTeam.color2} size={20} />
                        <span className="truncate">{m.homeTeam.shortName}</span>
                        <span className="text-muted">พบ</span>
                        <TeamBadge name={m.awayTeam.name} logoUrl={m.awayTeam.logoUrl} color={m.awayTeam.color} color2={m.awayTeam.color2} size={20} />
                        <span className="truncate">{m.awayTeam.shortName}</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-center tnum font-semibold">
                      {m.homeGoals !== null ? `${m.homeGoals}–${m.awayGoals}` : "—"}
                    </td>
                    <td className="py-2.5 text-xs text-muted">{thaiDateTime(m.kickoffAt)}</td>
                    <td className="hidden py-2.5 text-xs text-muted lg:table-cell">{m.referee?.name ?? "—"}</td>
                    <td className="py-2.5"><StatusPill status={m.status} /></td>
                    <td className="py-2.5 pr-4 text-right">
                      {unfilled(m) ? (
                        <span
                          title="ใส่สโมสรของทั้งสองฝั่งที่หน้าฤดูกาลก่อน"
                          className="inline-block cursor-not-allowed whitespace-nowrap rounded-lg border border-line bg-canvas px-3 py-1 text-xs font-medium text-muted"
                        >
                          {actionLabel(m)}
                        </span>
                      ) : (
                        <Link
                          href={`/admin/matches/${m.id}`}
                          className={`inline-block whitespace-nowrap rounded-lg border px-3 py-1 text-xs font-medium transition ${
                            notStarted(m)
                              ? "border-brand bg-brand text-white hover:opacity-90"
                              : "border-line hover:border-brand hover:text-brand"
                          }`}
                        >
                          {actionLabel(m)}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
        active ? "border-ink bg-surface font-medium" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
