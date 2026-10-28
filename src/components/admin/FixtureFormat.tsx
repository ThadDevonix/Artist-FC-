"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/admin/Form";
import { fixtureSummary } from "@/lib/fixtures";
import { cupSummary, koRoundName, MAX_GROUPS } from "@/lib/knockout";

export type FixtureFormatDefaults = {
  format?: "LEAGUE" | "CUP";
  teams?: number;
  rounds?: number;
  groupCount?: number;
  groupSize?: number;
  advancePerGroup?: number;
  knockoutLegs?: number;
};

/**
 * รูปแบบการแข่ง: ลีกพบกันหมด หรือแบ่งกลุ่ม + น็อคเอาต์ — พร้อมบอกทันทีว่าจะได้กี่นัด
 * (เช่น 20 ทีม เหย้า–เยือน → 38 นัด · 4 กลุ่ม × 4 ทีม ผ่านกลุ่มละ 2 → รอบ 8 ทีม รองฯ ชิง)
 */
export function FixtureFormat({
  defaults = {},
  max,
  required = false,
  cupExtra,
}: {
  defaults?: FixtureFormatDefaults;
  max: number;
  required?: boolean;
  /** ช่องเพิ่มเติมที่แสดงเฉพาะแบบแบ่งกลุ่ม (เช่น ต่อเวลา/จุดโทษ ในฟอร์มสร้างฤดูกาล) */
  cupExtra?: React.ReactNode;
}) {
  const [format, setFormat] = useState(defaults.format ?? "LEAGUE");
  const [teams, setTeams] = useState(defaults.teams ? String(defaults.teams) : "");
  const [rounds, setRounds] = useState(String(defaults.rounds ?? 1));
  const [groupCount, setGroupCount] = useState(String(defaults.groupCount || 4));
  const [groupSize, setGroupSize] = useState(String(defaults.groupSize || 4));
  const [advance, setAdvance] = useState(String(defaults.advancePerGroup ?? 2));
  const [legs, setLegs] = useState(String(defaults.knockoutLegs ?? 1));

  const n = Number(teams);
  const valid = Number.isInteger(n) && n >= 2 && n <= max;
  const league = valid ? fixtureSummary(n, rounds === "2" ? 2 : 1) : null;
  const cup = cupSummary({
    groupCount: Number(groupCount),
    groupSize: Number(groupSize),
    advancePerGroup: Number(advance),
    rounds: rounds === "2" ? 2 : 1,
    knockoutLegs: legs === "2" ? 2 : 1,
  });

  return (
    <div className="space-y-3">
      <input type="hidden" name="format" value={format} />
      <div role="radiogroup" aria-label="รูปแบบการแข่ง" className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 text-sm">
        {(
          [
            ["LEAGUE", "ลีก (พบกันหมด)"],
            ["CUP", "แบ่งกลุ่ม + น็อคเอาต์"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={format === value}
            onClick={() => setFormat(value)}
            className={`rounded-lg px-3 py-2 font-medium transition ${format === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {format === "LEAGUE" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="จำนวนทีม">
              <input
                type="number"
                name="teamCount"
                min={2}
                max={max}
                required={required}
                value={teams}
                onChange={(e) => setTeams(e.target.value)}
                placeholder="เช่น 20"
                className={inputClass}
              />
            </Field>
            <Field label="รูปแบบ">
              <select name="rounds" value={rounds} onChange={(e) => setRounds(e.target.value)} className={inputClass}>
                <option value={1}>เจอกันหมดนัดเดียว</option>
                <option value={2}>เหย้า–เยือน</option>
              </select>
            </Field>
          </div>

          {league && (
            <p className="rounded-lg bg-canvas px-3 py-2.5 text-sm">
              {n} ทีม → <strong>{league.totalRounds} นัด</strong> ({league.totalMatches} คู่ · ทีมละ {league.matchesPerTeam} เกม)
              {league.hasBye && <span className="block text-xs text-muted">จำนวนทีมเป็นเลขคี่ — แต่ละนัดจะมี 1 ทีมได้พัก</span>}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="จำนวนกลุ่ม">
              <input type="number" name="groupCount" min={1} max={MAX_GROUPS} required value={groupCount} onChange={(e) => setGroupCount(e.target.value)} className={inputClass} />
            </Field>
            <Field label="ทีมต่อกลุ่ม">
              <input type="number" name="groupSize" min={2} max={8} required value={groupSize} onChange={(e) => setGroupSize(e.target.value)} className={inputClass} />
            </Field>
            <Field label="ในกลุ่มเจอกัน">
              <select name="rounds" value={rounds} onChange={(e) => setRounds(e.target.value)} className={inputClass}>
                <option value={1}>นัดเดียว</option>
                <option value={2}>เหย้า–เยือน</option>
              </select>
            </Field>
            <Field label="ผ่านเข้ารอบกลุ่มละ">
              <select name="advancePerGroup" value={advance} onChange={(e) => setAdvance(e.target.value)} className={inputClass}>
                {[1, 2, 4].map((v) => (
                  <option key={v} value={v}>{v} ทีม</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="รอบน็อคเอาต์ (แพ้ตกรอบ)">
            <select name="knockoutLegs" value={legs} onChange={(e) => setLegs(e.target.value)} className={inputClass}>
              <option value={1}>นัดเดียวจบ</option>
              <option value={2}>เหย้า–เยือน (นัดชิงนัดเดียว)</option>
            </select>
          </Field>

          {cup.ok ? (
            <p className="rounded-lg bg-canvas px-3 py-2.5 text-sm">
              {groupCount} กลุ่ม × {groupSize} ทีม = <strong>{cup.teams} ทีม</strong>
              <span className="block">
                รอบแบ่งกลุ่ม {cup.groupRounds} นัด ({cup.groupMatches} คู่) → เข้ารอบ {cup.qualifiers} ทีม
              </span>
              <span className="block">
                น็อคเอาต์: {cup.koSizes.map(koRoundName).join(" → ")} ({cup.koMatches} คู่)
              </span>
              {cup.teams > max && <span className="block text-xs text-loss">เกิน {max} ทีม — ลดจำนวนกลุ่มหรือทีมต่อกลุ่ม</span>}
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">{cup.error}</p>
          )}
          {cupExtra}
        </>
      )}
    </div>
  );
}
