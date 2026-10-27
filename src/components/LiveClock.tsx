"use client";

import { useEffect, useState } from "react";
import { readClock, readStopwatch, type LiveClockInput } from "@/lib/live-clock";

/**
 * นาฬิกาที่เดินเองทุกวินาทีบนเครื่องคนดู
 * serverNow = เวลาของเซิร์ฟเวอร์ตอน render ใช้ชดเชยนาฬิกาเครื่องคนดูที่เพี้ยน
 */
export function LiveClock({
  serverNow,
  className = "",
  variant = "minute",
  ...input
}: LiveClockInput & {
  serverNow: number;
  className?: string;
  /** minute = นาทีแบบฟุตบอล (37', 45+2') · stopwatch = นาฬิกาจับเวลาสีเขียว MM:SS */
  variant?: "minute" | "stopwatch";
}) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const offset = serverNow - Date.now();
    const tick = () => setNow(Date.now() + offset);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [serverNow]);

  if (variant === "stopwatch") {
    const time = readStopwatch(input, now);
    if (!time) return null;
    return (
      <span className={`rounded-lg bg-green-50 px-2.5 py-0.5 font-mono font-semibold tnum text-green-700 dark:bg-green-950 dark:text-green-400 ${className}`}>
        {time}
      </span>
    );
  }

  const { label } = readClock(input, now);
  if (!label) return null;
  return <span className={`font-semibold tnum text-red-600 dark:text-red-400 ${className}`}>{label}</span>;
}
