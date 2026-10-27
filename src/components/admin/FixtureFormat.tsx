"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/admin/Form";
import { fixtureSummary } from "@/lib/fixtures";

/** ช่องจำนวนทีม + รูปแบบการแข่ง พร้อมบอกทันทีว่าจะได้กี่นัด (เช่น 20 ทีม เหย้า–เยือน → 38 นัด) */
export function FixtureFormat({
  defaultTeams,
  defaultRounds = 1,
  max,
  required = false,
}: {
  defaultTeams?: number;
  defaultRounds?: number;
  max: number;
  required?: boolean;
}) {
  const [teams, setTeams] = useState(defaultTeams ? String(defaultTeams) : "");
  const [rounds, setRounds] = useState(String(defaultRounds));

  const n = Number(teams);
  const valid = Number.isInteger(n) && n >= 2 && n <= max;
  const preview = valid ? fixtureSummary(n, rounds === "2" ? 2 : 1) : null;

  return (
    <div className="space-y-3">
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

      {preview && (
        <p className="rounded-lg bg-canvas px-3 py-2.5 text-sm">
          {n} ทีม → <strong>{preview.totalRounds} นัด</strong> ({preview.totalMatches} คู่ · ทีมละ {preview.matchesPerTeam} เกม)
          {preview.hasBye && <span className="block text-xs text-muted">จำนวนทีมเป็นเลขคี่ — แต่ละนัดจะมี 1 ทีมได้พัก</span>}
        </p>
      )}
    </div>
  );
}
