"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/admin/Form";

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

export function EventForm({
  matchId,
  action,
  teams,
  players,
}: {
  matchId: string;
  action: (prev: State, formData: FormData) => Promise<State>;
  teams: { id: string; name: string }[];
  players: { id: string; name: string; number: number | null; teamId: string | null }[];
}) {
  const [state, formAction] = useActionState(action, {});
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [type, setType] = useState("GOAL");

  // ทำเข้าประตูตัวเอง: คนยิงอยู่ทีมตรงข้ามกับทีมที่ได้ประตู
  const playerTeamId =
    type === "OWN_GOAL" ? teams.find((t) => t.id !== teamId)?.id ?? teamId : teamId;

  const squad = players.filter((p) => p.teamId === playerTeamId);
  const assistSquad = players.filter((p) => p.teamId === teamId);

  const label = (p: { name: string; number: number | null }) =>
    p.number ? `${p.number}. ${p.name}` : p.name;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="matchId" value={matchId} />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{state.ok}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ทีมที่ได้ประโยชน์">
          <select
            name="teamId"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className={inputClass}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>

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

      <Field
        label="นักเตะ"
        hint={type === "OWN_GOAL" ? "เลือกผู้เล่นฝั่งตรงข้ามที่ทำเข้าประตูตัวเอง" : undefined}
      >
        <select name="playerId" required className={inputClass} key={playerTeamId}>
          <option value="">— เลือกนักเตะ —</option>
          {squad.map((p) => (
            <option key={p.id} value={p.id}>{label(p)}</option>
          ))}
        </select>
      </Field>

      {WITH_ASSIST.has(type) && (
        <Field label="ผู้จ่ายบอล (ถ้ามี)">
          <select name="assistPlayerId" className={inputClass}>
            <option value="">— ไม่มี —</option>
            {assistSquad.map((p) => (
              <option key={p.id} value={p.id}>{label(p)}</option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="นาที">
          <input name="minute" type="number" min={1} max={130} required className={inputClass} />
        </Field>
        <Field label="ทดเจ็บ (ถ้ามี)">
          <input name="extraMinute" type="number" min={1} max={20} placeholder="เช่น 3" className={inputClass} />
        </Field>
      </div>

      <SubmitButton className="w-full">เพิ่มเหตุการณ์</SubmitButton>
    </form>
  );
}
