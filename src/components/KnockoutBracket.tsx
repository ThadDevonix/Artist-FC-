import Link from "next/link";
import { TeamBadge } from "@/components/ui";
import { aggregate, koRoundName, tieWinner } from "@/lib/knockout";
import { thaiDayMonth } from "@/lib/format";

type BracketTeam = {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  color: string;
  color2: string | null;
  isPlaceholder: boolean;
};

export type BracketMatch = {
  id: string;
  status: string;
  kickoffAt: Date | null;
  koSize: number | null;
  koSlot: number | null;
  leg: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homePens: number | null;
  awayPens: number | null;
  homeTeam: BracketTeam;
  awayTeam: BracketTeam;
};

/**
 * สายการแข่งขันรอบน็อคเอาต์ — คอลัมน์ละรอบ (8 ทีม → รองฯ → ชิง) จอแคบเลื่อนซ้ายขวาได้
 * คู่ที่ยังไม่รู้ทีมแสดงชื่อชั่วคราว เช่น "ที่ 1 กลุ่ม A" / "ผู้ชนะ 8 ทีม คู่ 1"
 * linkBase = ลิงก์ไปหน้านัด (หน้าเว็บ /matches, หลังบ้าน /admin/matches)
 */
export function KnockoutBracket({ matches, linkBase = "/matches" }: { matches: BracketMatch[]; linkBase?: string }) {
  if (matches.length === 0) return null;

  const sizes = [...new Set(matches.map((m) => m.koSize!))].sort((a, b) => b - a);

  return (
    <div className="no-scrollbar overflow-x-auto px-4 pb-4 sm:px-5">
      <div className="flex min-w-max gap-4">
        {sizes.map((size) => {
          const slots = [...new Set(matches.filter((m) => m.koSize === size).map((m) => m.koSlot!))].sort((a, b) => a - b);
          return (
            <div key={size} className="flex w-60 flex-col">
              <h3 className="mb-2 text-xs font-semibold text-muted">{koRoundName(size)}</h3>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {slots.map((slot) => (
                  <Tie key={slot} legs={matches.filter((m) => m.koSize === size && m.koSlot === slot)} linkBase={linkBase} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tie({ legs, linkBase }: { legs: BracketMatch[]; linkBase: string }) {
  const ordered = [...legs].sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
  const first = ordered[0];
  // ฝั่งบน = เจ้าบ้านนัดแรก
  const sides = [first.homeTeam, first.awayTeam];
  const winner = tieWinner(ordered.map((l) => ({ ...l, homeTeamId: l.homeTeam.id, awayTeamId: l.awayTeam.id })));
  const played = ordered.filter((l) => l.homeGoals !== null && l.awayGoals !== null);
  const goals = aggregate(played.map((l) => ({ ...l, homeTeamId: l.homeTeam.id, awayTeamId: l.awayTeam.id })));
  const deciding = ordered[ordered.length - 1];
  const pens = deciding.homePens !== null && deciding.awayPens !== null ? deciding : null;
  const live = ordered.some((l) => l.status === "LIVE");

  return (
    <Link
      href={`${linkBase}/${(ordered.find((l) => l.status === "LIVE") ?? ordered.find((l) => l.homeGoals === null) ?? deciding).id}`}
      className={`block rounded-xl border bg-surface transition hover:border-ink ${live ? "border-red-400" : "border-line"}`}
    >
      {sides.map((team) => {
        const won = winner === team.id;
        const lost = winner !== null && !won;
        const penScore = pens ? (pens.homeTeam.id === team.id ? pens.homePens : pens.awayPens) : null;
        return (
          <div
            key={team.id}
            className={`flex items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-0 ${lost ? "text-muted" : ""}`}
          >
            <TeamBadge name={team.name} logoUrl={team.logoUrl} color={team.color} color2={team.color2} size={18} />
            <span className={`min-w-0 flex-1 truncate ${won ? "font-semibold" : ""} ${team.isPlaceholder ? "text-muted italic" : ""}`}>
              {team.shortName}
            </span>
            {ordered.length > 1 &&
              ordered.map((l) => (
                <span key={l.id} className="w-4 text-center text-xs text-muted tnum">
                  {l.homeGoals === null ? "" : l.homeTeam.id === team.id ? l.homeGoals : l.awayGoals}
                </span>
              ))}
            {penScore !== null && <span className="text-[11px] text-muted tnum">({penScore})</span>}
            <span className={`w-5 text-right tnum ${won ? "font-bold" : ""}`}>{played.length ? (goals.get(team.id) ?? 0) : ""}</span>
          </div>
        );
      })}
      {played.length === 0 && (
        <div className="border-t border-line px-3 py-1 text-[11px] text-muted">
          {first.kickoffAt ? thaiDayMonth(first.kickoffAt) : "ยังไม่กำหนดวัน"}
          {ordered.length > 1 && " · เหย้า–เยือน"}
        </div>
      )}
    </Link>
  );
}
