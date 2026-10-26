/** ไอคอนของเหตุการณ์ในเกม — คำอธิบายอยู่ที่ src/lib/labels.ts */
import { EVENT_LABEL as EVENT_LABEL_MAP } from "@/lib/labels";

export function EventIcon({ type, isAssist = false }: { type: string; isAssist?: boolean }) {
  if (isAssist) return <span title="แอสซิสต์">👟</span>;
  switch (type) {
    case "GOAL":
      return <span title="ประตู">⚽</span>;
    case "PENALTY_GOAL":
      return <span title="ประตูจากจุดโทษ">⚽</span>;
    case "OWN_GOAL":
      return <span title="เข้าประตูตัวเอง">🙈</span>;
    case "PENALTY_MISS":
      return <span title="ยิงจุดโทษไม่เข้า">❌</span>;
    case "YELLOW":
      return <span title="ใบเหลือง" className="inline-block h-4 w-3 rounded-[2px] bg-yellow-400 align-middle" />;
    case "SECOND_YELLOW":
      return <span title="ใบเหลืองใบที่สอง" className="inline-block h-4 w-3 rounded-[2px] bg-orange-500 align-middle" />;
    case "RED":
      return <span title="ใบแดง" className="inline-block h-4 w-3 rounded-[2px] bg-red-600 align-middle" />;
    default:
      return null;
  }
}

export { EVENT_LABEL } from "@/lib/labels";

export function eventLabel(type: string) {
  return (EVENT_LABEL_MAP as Record<string, string>)[type] ?? type;
}
