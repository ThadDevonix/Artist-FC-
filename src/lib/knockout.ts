/**
 * ฤดูกาลแบบแบ่งกลุ่ม + น็อคเอาต์ — ตรรกะบริสุทธิ์ ไม่แตะฐานข้อมูล
 *
 * รอบแบ่งกลุ่ม: ทีมในกลุ่มเดียวกันพบกันหมด (นัดเดียวหรือเหย้า-เยือน) อันดับต้น ๆ ของแต่ละกลุ่มผ่านเข้ารอบ
 * รอบน็อคเอาต์: แพ้ตกรอบ สร้างทุกคู่ไว้ตั้งแต่แรกโดยรู้แค่ว่า "ทีมมาจากไหน" (source) แล้วค่อยใส่ทีมจริงเมื่อรู้ผล
 *   G:<กลุ่ม>:<อันดับ>   เช่น G:1:2 = ที่ 2 กลุ่ม A
 *   W:<จำนวนทีมในรอบ>:<คู่ที่>  เช่น W:8:3 = ผู้ชนะคู่ที่ 3 ของรอบ 8 ทีม
 */

export const MAX_GROUPS = 8;

export const groupLetter = (group: number) => String.fromCharCode(64 + group);

export const isPowerOfTwo = (n: number) => n >= 2 && (n & (n - 1)) === 0;

/** ชื่อรอบตามจำนวนทีมที่เหลือ */
export function koRoundName(size: number) {
  if (size === 2) return "นัดชิงชนะเลิศ";
  if (size === 4) return "รอบรองชนะเลิศ";
  return `รอบ ${size} ทีมสุดท้าย`;
}

/** ชื่อสั้นของรอบ ใช้ต่อท้าย "ผู้ชนะ…" */
function koRoundShort(size: number) {
  if (size === 2) return "นัดชิง";
  if (size === 4) return "รองฯ";
  return `${size} ทีม`;
}

/** ชื่อรอบพร้อมนัดแรก/นัดสอง — ใช้เป็นป้ายของนัด */
export function koLabel(size: number, leg: number | null) {
  const name = koRoundName(size);
  return leg ? `${name} นัด${leg === 1 ? "แรก" : "สอง"}` : name;
}

export type CupConfig = {
  groupCount: number;
  groupSize: number;
  advancePerGroup: number;
  /** 1 = ในกลุ่มเจอกันนัดเดียว, 2 = เหย้า-เยือน */
  rounds: 1 | 2;
  /** 1 = น็อคเอาต์นัดเดียว, 2 = เหย้า-เยือน (นัดชิงนัดเดียวเสมอ) */
  knockoutLegs: 1 | 2;
};

/** ตรวจรูปแบบและสรุปจำนวนนัด — คืนข้อความผิดพลาดถ้าจัดสายไม่ได้ */
export function cupSummary(c: CupConfig):
  | { ok: true; teams: number; groupRounds: number; groupMatches: number; qualifiers: number; koSizes: number[]; koMatches: number }
  | { ok: false; error: string } {
  if (c.groupCount < 1 || c.groupCount > MAX_GROUPS) return { ok: false, error: `จำนวนกลุ่มต้องอยู่ระหว่าง 1–${MAX_GROUPS}` };
  if (c.groupSize < 2 || c.groupSize > 8) return { ok: false, error: "ทีมต่อกลุ่มต้องอยู่ระหว่าง 2–8" };
  if (c.advancePerGroup < 1 || c.advancePerGroup > c.groupSize) {
    return { ok: false, error: `ผ่านเข้ารอบได้กลุ่มละ 1–${c.groupSize} ทีม` };
  }
  const qualifiers = c.groupCount * c.advancePerGroup;
  if (!isPowerOfTwo(qualifiers)) {
    return {
      ok: false,
      error: `ทีมเข้ารอบน็อคเอาต์รวม ${qualifiers} ทีม — ต้องเป็น 2, 4, 8, 16 หรือ 32 ทีมจึงจะจัดสายแพ้คัดออกได้ลงตัว`,
    };
  }
  if (c.groupCount > 1 && c.advancePerGroup > 1 && c.advancePerGroup % 2 === 1) {
    return { ok: false, error: "ผ่านเข้ารอบกลุ่มละ 1, 2, 4 … ทีม เพื่อให้จับคู่ไขว้สายได้" };
  }
  const slots = c.groupSize % 2 === 1 ? c.groupSize + 1 : c.groupSize;
  const koSizes: number[] = [];
  for (let s = qualifiers; s >= 2; s /= 2) koSizes.push(s);
  return {
    ok: true,
    teams: c.groupCount * c.groupSize,
    groupRounds: (slots - 1) * c.rounds,
    groupMatches: ((c.groupSize * (c.groupSize - 1)) / 2) * c.rounds * c.groupCount,
    qualifiers,
    koSizes,
    koMatches: koSizes.reduce((n, s) => n + (s / 2) * (c.knockoutLegs === 2 && s > 2 ? 2 : 1), 0),
  };
}

/**
 * คู่รอบแรกของน็อคเอาต์ เรียงตามตำแหน่งในสาย (คู่ 1 กับ 2 จะเจอกันในรอบถัดไป)
 * - กลุ่มเดียว: มือ 1 พบมือสุดท้าย, 2 พบรองสุดท้าย … จัดให้มือ 1 กับ 2 อยู่คนละครึ่งสาย
 * - หลายกลุ่ม: จับกลุ่มเป็นคู่ (A–B, C–D …) แล้วไขว้อันดับ เช่น 1A–2B, 1B–2A
 *   ครึ่งสายบนเป็นคู่ที่ "แชมป์กลุ่มแรกของคู่กลุ่ม" อยู่ ครึ่งล่างเป็นอีกฝั่ง ทีมกลุ่มเดียวกันจึงเจอกันอีกได้แค่นัดชิง
 */
export function firstRoundSeeds(groupCount: number, advance: number): [string, string][] {
  const g = (group: number, pos: number) => `G:${group}:${pos}`;

  if (groupCount === 1) {
    return bracketOrder(advance).map(([a, b]) => [g(1, a), g(1, b)]);
  }

  const top: [string, string][] = [];
  const bottom: [string, string][] = [];
  for (let x = 1; x < groupCount; x += 2) {
    const y = x + 1;
    if (advance === 1) {
      top.push([g(x, 1), g(y, 1)]);
      continue;
    }
    for (let p = 1; p <= advance / 2; p++) {
      top.push([g(x, p), g(y, advance + 1 - p)]);
      bottom.push([g(y, p), g(x, advance + 1 - p)]);
    }
  }
  // advance = 1: คู่กลุ่มเรียงต่อกัน · ที่เหลือ: ครึ่งบนก่อน แล้วครึ่งล่าง
  return advance === 1 ? top : [...top, ...bottom];
}

/** มือวาง 1…n เป็นคู่ตามตำแหน่งในสาย แบบที่มือ 1 และ 2 เจอกันได้แค่นัดชิง (1–8, 4–5, 2–7, 3–6) */
function bracketOrder(n: number): [number, number][] {
  let seeds = [1];
  while (seeds.length < n) {
    const m = seeds.length * 2 + 1;
    seeds = seeds.flatMap((s) => [s, m - s]);
  }
  const pairs: [number, number][] = [];
  for (let i = 0; i < seeds.length; i += 2) pairs.push([seeds[i], seeds[i + 1]]);
  return pairs;
}

export type KnockoutFixture = {
  round: number;
  koSize: number;
  koSlot: number;
  leg: number | null;
  homeSource: string;
  awaySource: string;
};

/** ทุกนัดของรอบน็อคเอาต์ ต่อเลขนัดจาก startRound (นัดหลังรอบแบ่งกลุ่ม) */
export function knockoutFixtures(c: Pick<CupConfig, "groupCount" | "advancePerGroup" | "knockoutLegs">, startRound: number) {
  const out: KnockoutFixture[] = [];
  let round = startRound;
  let ties: [string, string][] = firstRoundSeeds(c.groupCount, c.advancePerGroup);

  for (let size = ties.length * 2; size >= 2; size /= 2) {
    const twoLegs = c.knockoutLegs === 2 && size > 2;
    ties.forEach(([a, b], i) => {
      const koSlot = i + 1;
      if (twoLegs) {
        out.push({ round, koSize: size, koSlot, leg: 1, homeSource: a, awaySource: b });
        out.push({ round: round + 1, koSize: size, koSlot, leg: 2, homeSource: b, awaySource: a });
      } else {
        out.push({ round, koSize: size, koSlot, leg: null, homeSource: a, awaySource: b });
      }
    });
    round += twoLegs ? 2 : 1;
    const next: [string, string][] = [];
    for (let k = 1; k <= ties.length / 2; k++) next.push([`W:${size}:${2 * k - 1}`, `W:${size}:${2 * k}`]);
    ties = next;
  }
  return out;
}

export type ParsedSource = { kind: "group"; group: number; pos: number } | { kind: "winner"; size: number; slot: number };

export function parseSource(source: string): ParsedSource | null {
  const [kind, a, b] = source.split(":");
  const x = Number(a), y = Number(b);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (kind === "G") return { kind: "group", group: x, pos: y };
  if (kind === "W") return { kind: "winner", size: x, slot: y };
  return null;
}

/** ชื่อทีมชั่วคราวระหว่างรอรู้ผล เช่น "ที่ 1 กลุ่ม A", "ผู้ชนะ 8 ทีม คู่ 3" */
export function sourceTeamName(source: string) {
  const s = parseSource(source);
  if (!s) return { name: source, shortName: source, code: "?" };
  if (s.kind === "group") {
    const name = `ที่ ${s.pos} กลุ่ม ${groupLetter(s.group)}`;
    return { name, shortName: name, code: `${s.pos}${groupLetter(s.group)}` };
  }
  const name = `ผู้ชนะ${koRoundShort(s.size)} คู่ ${s.slot}`;
  return { name, shortName: name, code: `W${s.slot}` };
}

export type TieLeg = {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePens: number | null;
  awayPens: number | null;
  status: string;
  leg: number | null;
};

/**
 * ผลของคู่น็อคเอาต์ (1 หรือ 2 นัด) — ผู้ชนะคือประตูรวมมากกว่า ถ้าเท่ากันดูจุดโทษของนัดตัดสิน (นัดสุดท้าย)
 * ประตูช่วงต่อเวลารวมอยู่ใน homeGoals/awayGoals แล้ว · ยังมีนัดที่ไม่อนุมัติ = ยังไม่รู้ผล
 */
export function tieWinner(legs: TieLeg[]): string | null {
  if (legs.length === 0 || legs.some((l) => l.status !== "FINISHED" || l.homeGoals === null || l.awayGoals === null)) {
    return null;
  }
  const ordered = [...legs].sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
  const deciding = ordered[ordered.length - 1];
  const goals = aggregate(ordered);
  const a = deciding.homeTeamId, b = deciding.awayTeamId;
  if ((goals.get(a) ?? 0) !== (goals.get(b) ?? 0)) return (goals.get(a) ?? 0) > (goals.get(b) ?? 0) ? a : b;
  if (deciding.homePens === null || deciding.awayPens === null || deciding.homePens === deciding.awayPens) return null;
  return deciding.homePens > deciding.awayPens ? a : b;
}

/** ประตูรวมของแต่ละทีมในคู่ (รวมทุกนัดที่มีสกอร์) */
export function aggregate(legs: Pick<TieLeg, "homeTeamId" | "awayTeamId" | "homeGoals" | "awayGoals">[]) {
  const goals = new Map<string, number>();
  for (const l of legs) {
    if (l.homeGoals === null || l.awayGoals === null) continue;
    goals.set(l.homeTeamId, (goals.get(l.homeTeamId) ?? 0) + l.homeGoals);
    goals.set(l.awayTeamId, (goals.get(l.awayTeamId) ?? 0) + l.awayGoals);
  }
  return goals;
}

/**
 * นัดนี้เป็นนัดตัดสินของคู่ไหม (นัดเดียว หรือนัดสองของเหย้า-เยือน) — ใช้ตัดสินว่าต่อเวลา/ยิงจุดโทษได้ไหม
 * และถ้าจบด้วยสกอร์นี้ ประตูรวมเสมอกันหรือเปล่า
 */
export function decidingTie(
  match: { homeTeamId: string; awayTeamId: string; leg: number | null; koSize: number | null },
  score: { homeGoals: number; awayGoals: number },
  firstLeg?: Pick<TieLeg, "homeTeamId" | "awayTeamId" | "homeGoals" | "awayGoals"> | null,
) {
  if (!match.koSize || match.leg === 1) return { deciding: false, level: false };
  const goals = aggregate([
    ...(firstLeg ? [firstLeg] : []),
    { homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId, ...score },
  ]);
  return { deciding: true, level: (goals.get(match.homeTeamId) ?? 0) === (goals.get(match.awayTeamId) ?? 0) };
}

/** ป้ายของนัด เช่น "นัดที่ 3", "กลุ่ม B · นัดที่ 2", "รอบรองชนะเลิศ นัดแรก" */
export function stageLabel(m: { round: number; group?: number | null; koSize?: number | null; leg?: number | null }) {
  if (m.koSize) return koLabel(m.koSize, m.leg ?? null);
  if (m.group) return `กลุ่ม ${groupLetter(m.group)} · นัดที่ ${m.round}`;
  return `นัดที่ ${m.round}`;
}

/** ป้ายของทั้งนัด (รอบ) — นัดในกลุ่มทุกกลุ่มใช้เลขนัดเดียวกัน · รอบน็อคเอาต์ใช้ชื่อรอบ */
export function roundTitle(r: { round: number; koSize?: number | null; leg?: number | null }) {
  return r.koSize ? koLabel(r.koSize, r.leg ?? null) : `นัดที่ ${r.round}`;
}
