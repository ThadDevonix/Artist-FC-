/**
 * สร้างตารางการแข่งขันแบบพบกันหมด (round-robin) ด้วย circle method / Berger table
 *
 * ตรึงทีมแรกไว้กับที่ แล้วหมุนทีมที่เหลือทวนเข็มนาฬิกา — ได้ผลว่าทุกทีมเจอกันครบ
 * ทีมละ 1 ครั้งต่อรอบ และไม่มีทีมไหนแข่งซ้อนกันในนัดเดียวกัน
 *
 * ถ้าจำนวนทีมเป็นเลขคี่ จะเติมทีมสมมติ "BYE" เข้าไป 1 ทีม
 * ทีมที่จับคู่กับ BYE ในนัดนั้นจะได้พัก
 */

import { addDaysYmd } from "@/lib/format";

export type FixturePair = {
  round: number; // นัดที่เท่าไหร่ (เริ่มที่ 1)
  homeTeamId: string;
  awayTeamId: string;
};

const BYE = "__BYE__";

export function generateRoundRobin(
  teamIds: string[],
  options: { rounds?: 1 | 2; shuffleSeed?: number } = {},
): FixturePair[] {
  const { rounds = 1, shuffleSeed } = options;

  if (teamIds.length < 2) {
    throw new Error("ต้องมีอย่างน้อย 2 ทีมจึงจะสร้างตารางแข่งได้");
  }
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("มีรหัสทีมซ้ำกันในรายการ");
  }

  const teams = shuffleSeed === undefined ? [...teamIds] : shuffle(teamIds, shuffleSeed);
  if (teams.length % 2 === 1) teams.push(BYE);

  const n = teams.length;
  const roundsPerLeg = n - 1;
  const half = n / 2;

  const firstLeg: FixturePair[] = [];
  // ตำแหน่งที่หมุน: ตรึง teams[0] ไว้ หมุนที่เหลือ
  let rotation = teams.slice(1);

  for (let r = 0; r < roundsPerLeg; r++) {
    const lineup = [teams[0], ...rotation];

    for (let i = 0; i < half; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      if (a === BYE || b === BYE) continue;

      // สลับเหย้า-เยือนทุกนัด เพื่อไม่ให้ทีมเดิมได้เล่นเหย้ารวดทุกนัด
      const homeFirst = (r + i) % 2 === 0;
      firstLeg.push({
        round: r + 1,
        homeTeamId: homeFirst ? a : b,
        awayTeamId: homeFirst ? b : a,
      });
    }

    rotation = [rotation[rotation.length - 1], ...rotation.slice(0, -1)];
  }

  if (rounds === 1) return firstLeg;

  // เลกสอง: สลับเหย้า-เยือน และต่อนัดจากเลกแรก
  const secondLeg: FixturePair[] = firstLeg.map((m) => ({
    round: m.round + roundsPerLeg,
    homeTeamId: m.awayTeamId,
    awayTeamId: m.homeTeamId,
  }));

  return [...firstLeg, ...secondLeg];
}

/** จำนวนนัดทั้งหมดที่จะเกิดขึ้น — ใช้แสดงตัวอย่างก่อนกดสร้างจริง */
export function fixtureSummary(teamCount: number, rounds: 1 | 2 = 1) {
  const slots = teamCount % 2 === 1 ? teamCount + 1 : teamCount;
  const roundsPerLeg = slots - 1;
  return {
    totalRounds: roundsPerLeg * rounds,
    totalMatches: ((teamCount * (teamCount - 1)) / 2) * rounds,
    matchesPerTeam: (teamCount - 1) * rounds,
    hasBye: teamCount % 2 === 1,
  };
}

/** สุ่มลำดับแบบกำหนด seed ได้ เพื่อให้ผลซ้ำเดิมเมื่อใช้ seed เดิม */
function shuffle<T>(input: T[], seed: number): T[] {
  const arr = [...input];
  let state = seed >>> 0 || 1;
  const next = () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * จัดวันเวลาให้ทุกคู่ แบบลีกจริง (เช่นพรีเมียร์ลีก): 1 นัดต่อ 1 ช่วงสัปดาห์ แล้วกระจายคู่ไปตามวันที่แข่ง
 *
 * - นัดที่ r อยู่ในช่วง 7 วันที่เริ่มจาก startYmd + (r-1) × weeksBetween สัปดาห์
 * - ในช่วงนั้น เลือกเฉพาะวันที่ตรงกับ weekdays (0 = อาทิตย์ … 6 = เสาร์) เรียงตามวันที่
 * - คู่ในนัดแบ่งลงวันให้ใกล้เคียงกัน (วันแรก ๆ ได้ก่อนถ้าหารไม่ลงตัว)
 * - ในวันเดียวกันไล่ใช้เวลาตาม times · คู่เกินจำนวนเวลา → วนกลับใช้เวลาแรก (หลายสนามเตะพร้อมกัน)
 * แต่ละทีมเตะนัดละครั้ง จึงไม่มีทีมไหนเตะ 2 ครั้งในวันเดียว
 *
 * คืน Map จากคู่ → [วันที่ YYYY-MM-DD, เวลา HH:mm] (ตามเวลาไทย)
 */
export function scheduleRounds<T extends { round: number }>(
  pairs: T[],
  { startYmd, weekdays, times, weeksBetween = 1 }: { startYmd: string; weekdays: number[]; times: string[]; weeksBetween?: number },
): Map<T, [string, string]> {
  const out = new Map<T, [string, string]>();
  const byRound = new Map<number, T[]>();
  for (const p of pairs) byRound.set(p.round, [...(byRound.get(p.round) ?? []), p]);

  for (const [round, list] of byRound) {
    const weekStart = addDaysYmd(startYmd, (round - 1) * 7 * weeksBetween);
    const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekStart, i)).filter((d) =>
      weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()),
    );
    const perDay = new Map<string, number>();
    list.forEach((p, i) => {
      const day = days[Math.floor((i * days.length) / list.length)];
      const k = perDay.get(day) ?? 0;
      perDay.set(day, k + 1);
      out.set(p, [day, times[k % times.length]]);
    });
  }
  return out;
}
