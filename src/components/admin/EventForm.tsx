"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/admin/Form";
import { readClock, type LiveClockInput } from "@/lib/live-clock";
import { TeamBadge } from "@/components/ui";

type State = { error?: string; ok?: string };

const TYPES = [
  { value: "GOAL", label: "ประตู" },
  { value: "PENALTY_GOAL", label: "ประตูจากจุดโทษ" },
  { value: "OWN_GOAL", label: "ทำเข้าประตูตัวเอง" },
  { value: "PENALTY_MISS", label: "ยิงจุดโทษไม่เข้า" },
  { value: "YELLOW", label: "ใบเหลือง" },
  { value: "SECOND_YELLOW", label: "ใบเหลืองใบที่สอง" },
  { value: "RED", label: "ใบแดง" },
];

const WITH_ASSIST = new Set(["GOAL", "PENALTY_GOAL"]);
const CARDS = new Set(["YELLOW", "SECOND_YELLOW", "RED"]);

export function EventForm({
  matchId,
  action,
  teams,
  players,
  officials,
  liveClock,
}: {
  matchId: string;
  /** มีเมื่อกำลังถ่ายทอดสด — ใช้เติมนาทีปัจจุบันให้ช่องนาทีอัตโนมัติ */
  liveClock?: LiveClockInput & { serverNow: number };
  /** ทีมผู้ตัดสินของนัด เรียงตามช่อง (คนแรกคือผู้ตัดสินที่ 1 = ค่าเริ่มต้นของผู้ให้ใบ) */
  officials: { id: string; name: string; slot: string }[];
  action: (prev: State, formData: FormData) => Promise<State>;
  teams: {
    id: string;
    name: string;
    fullName: string;
    code: string;
    logoUrl: string | null;
    color: string;
    color2: string | null;
    side: string;
  }[];
  players: { id: string; name: string; number: number | null; teamId: string | null }[];
}) {
  const [state, formAction] = useActionState(action, {});
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [type, setType] = useState("GOAL");
  const minuteRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  // นาทีตอนเปิดฟอร์ม — ปุ่ม "ตอนนี้" ดึงนาทีล่าสุดอีกครั้งก่อนบันทึก (ชดเชยนาฬิกาเครื่องด้วยเวลาเซิร์ฟเวอร์)
  const [clockOffset] = useState(() => (liveClock ? liveClock.serverNow - Date.now() : 0));
  const readNow = () => (liveClock ? readClock(liveClock, Date.now() + clockOffset) : null);
  const [initial] = useState(() => (liveClock ? readClock(liveClock, liveClock.serverNow) : null));
  function fillNow() {
    const r = readNow();
    if (!r || r.minute === null) return;
    if (minuteRef.current) minuteRef.current.value = String(r.minute);
    if (extraRef.current) extraRef.current.value = r.extra ? String(r.extra) : "";
  }

  // ทำเข้าประตูตัวเอง: คนยิงอยู่ทีมตรงข้ามกับทีมที่ได้ประตู
  const playerTeamId =
    type === "OWN_GOAL" ? teams.find((t) => t.id !== teamId)?.id ?? teamId : teamId;

  const squad = players.filter((p) => p.teamId === playerTeamId);
  const assistSquad = players.filter((p) => p.teamId === teamId);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "";

  // บันทึกสำเร็จ → ล้างช่องเบอร์ (เปลี่ยน key ให้ช่องสร้างใหม่) ปรับ state ระหว่าง render แทน useEffect
  const [resetKey, setResetKey] = useState(0);
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setResetKey((k) => k + 1);
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="matchId" value={matchId} />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{state.ok}</p>
      )}

      {/* เลือกทีมด้วยปุ่มที่มีโลโก้ — เห็นชัดกว่าช่องเลือก กันบันทึกผิดฝั่ง */}
      <fieldset>
        <legend className="mb-1 text-sm font-medium">ทีมที่ได้ประโยชน์</legend>
        <input type="hidden" name="teamId" value={teamId} />
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {teams.map((t) => {
            const active = t.id === teamId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTeamId(t.id)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition ${
                  active ? "border-brand bg-brand-soft" : "border-line hover:border-muted"
                }`}
              >
                <TeamBadge name={t.fullName} code={t.code} logoUrl={t.logoUrl} color={t.color} color2={t.color2} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">{t.side}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3">

        <Field label="ประเภท">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <PlayerByNumber
        key={`player-${playerTeamId}-${resetKey}`}
        name="playerId"
        label={type === "OWN_GOAL" ? `เบอร์นักเตะที่ทำเข้าประตูตัวเอง (${teamName(playerTeamId)})` : `เบอร์นักเตะ (${teamName(playerTeamId)})`}
        squad={squad}
        required
      />

      {WITH_ASSIST.has(type) && (
        <PlayerByNumber
          key={`assist-${teamId}-${resetKey}`}
          name="assistPlayerId"
          label="เบอร์ผู้จ่ายบอล (ถ้ามี)"
          squad={assistSquad}
        />
      )}

      {CARDS.has(type) && officials.length > 0 && (
        <Field label="ผู้ให้ใบ" hint="ปกติคือผู้ตัดสินที่ 1 — เปลี่ยนเมื่อเป็นคนอื่นในทีมผู้ตัดสิน">
          <select name="issuedById" defaultValue={officials[0].id} className={inputClass}>
            {officials.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.slot})</option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="นาที">
          <input
            ref={minuteRef}
            name="minute"
            type="number"
            min={1}
            max={130}
            required
            defaultValue={initial?.minute ?? undefined}
            className={inputClass}
          />
        </Field>
        <Field label="ทดเจ็บ (ถ้ามี)">
          <input
            ref={extraRef}
            name="extraMinute"
            type="number"
            min={1}
            max={20}
            placeholder="เช่น 3"
            defaultValue={initial?.extra ?? undefined}
            className={inputClass}
          />
        </Field>
      </div>
      {liveClock && liveClock.phase !== "HALF_TIME" && (
        <button
          type="button"
          onClick={fillNow}
          className="w-full rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          ⏱ ใช้นาทีปัจจุบัน
        </button>
      )}

      <SubmitButton className="w-full">เพิ่มเหตุการณ์</SubmitButton>
    </form>
  );
}

type SquadPlayer = { id: string; name: string; number: number | null };

/**
 * ช่องพิมพ์เบอร์เสื้อ แล้วโชว์ชื่อนักเตะทันที — เร็วกว่าไล่หาในรายการยาว ๆ ระหว่างไลฟ์
 * ส่งค่าเป็น id นักเตะผ่านช่องซ่อน · เบอร์ที่ไม่มีในทีม เบราว์เซอร์จะไม่ยอมให้กดบันทึก
 * นักเตะที่ไม่มีเบอร์ (ถ้ามี) เลือกจากรายการสำรองด้านล่างได้
 */
function PlayerByNumber({
  name,
  label,
  squad,
  required = false,
}: {
  name: string;
  label: string;
  squad: SquadPlayer[];
  required?: boolean;
}) {
  const [text, setText] = useState("");
  const [pickedId, setPickedId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const typed = text.trim();
  const byNumber = typed ? squad.find((p) => p.number === Number(typed)) : undefined;
  const unnumbered = squad.filter((p) => p.number === null);
  const picked = !typed ? unnumbered.find((p) => p.id === pickedId) : undefined;
  const player = byNumber ?? picked;
  const notFound = typed !== "" && !byNumber;

  // บอกเบราว์เซอร์ว่าช่องนี้ยังไม่ถูกต้อง → กดบันทึกแล้วจะเด้งเตือนที่ช่องนี้แทนการส่งฟอร์ม
  const message = notFound
    ? `ไม่พบเบอร์ ${typed} ในทีมนี้`
    : required && !player
      ? "กรุณากรอกเบอร์นักเตะ"
      : "";
  useEffect(() => {
    inputRef.current?.setCustomValidity(message);
  }, [message]);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor={`${name}-number`}>{label}</label>
      <input type="hidden" name={name} value={player?.id ?? ""} />
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          id={`${name}-number`}
          type="number"
          inputMode="numeric"
          min={1}
          max={99}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="#"
          className="w-20 rounded-lg border border-line bg-surface px-3 py-2 text-center text-lg font-bold tnum outline-none focus:border-ink"
        />
        <span className="min-w-0 flex-1 text-sm">
          {player ? (
            <span className="flex items-center gap-1.5 font-semibold text-win">
              <span aria-hidden>✓</span>
              <span className="truncate">{player.name}</span>
            </span>
          ) : notFound ? (
            <span className="font-medium text-loss">ไม่พบเบอร์ {typed} ในทีมนี้</span>
          ) : (
            <span className="text-muted">{required ? "พิมพ์เบอร์เสื้อ" : "เว้นว่างได้"}</span>
          )}
        </span>
      </div>
      {unnumbered.length > 0 && !typed && (
        <select
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
          className={`${inputClass} mt-2 text-xs`}
        >
          <option value="">— หรือเลือกนักเตะที่ไม่มีเบอร์ —</option>
          {unnumbered.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
