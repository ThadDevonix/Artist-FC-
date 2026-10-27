"use client";

import { useEffect, useRef, useState } from "react";
import { PlayerAvatar } from "@/components/ui";

const SIZE = 400; // พิกเซล — พอสำหรับรูปใหญ่สุดในเว็บ (80px) บนจอความละเอียดสูง
const QUALITY = 0.85;

/** ย่อ + ครอปกลางรูปให้เป็นสี่เหลี่ยมจัตุรัส แล้วคืนเป็น JPEG data URL */
async function toSquareJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIZE, side);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
    0, 0, canvas.width, canvas.height,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

/**
 * เลือกรูปนักเตะจากเครื่อง/กล้องมือถือ — ย่อในเบราว์เซอร์ก่อนส่ง ไฟล์จึงเล็กและส่งไวแม้เน็ตมือถือ
 * ส่งค่าไปกับฟอร์มผ่านช่องซ่อน photoData (รูปใหม่) และ removePhoto (กดลบรูป)
 */
export function PlayerPhotoInput({
  name,
  currentUrl,
  color,
  color2,
}: {
  name: string;
  currentUrl: string | null;
  color: string;
  color2: string | null;
}) {
  const [photoData, setPhotoData] = useState("");
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  const anchor = useRef<HTMLInputElement>(null);

  // ฟอร์มถูกรีเซ็ตหลังบันทึกสำเร็จ → ล้างรูปที่เลือกไว้ด้วย ไม่งั้นคนถัดไปจะได้รูปนี้ติดไป
  useEffect(() => {
    const form = anchor.current?.form;
    if (!form) return;
    const reset = () => { setPhotoData(""); setRemoved(false); setError(""); };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      setPhotoData(await toSquareJpeg(file));
      setRemoved(false);
    } catch {
      setError("เปิดไฟล์รูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG");
    }
  }

  const preview = photoData || (removed ? null : currentUrl);

  return (
    <div className="flex items-center gap-4">
      <input ref={anchor} type="hidden" name="photoData" value={photoData} />
      {removed && <input type="hidden" name="removePhoto" value="on" />}

      <PlayerAvatar name={name || "?"} photoUrl={preview} color={color} color2={color2} size={72} />

      <div className="flex flex-col items-start gap-1.5">
        <label className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          {preview ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
        {preview && (
          <button
            type="button"
            onClick={() => (photoData ? setPhotoData("") : setRemoved(true))}
            className="text-xs text-muted hover:text-loss"
          >
            {photoData ? "ยกเลิกรูปที่เลือก" : "ลบรูป"}
          </button>
        )}
        {photoData && <span className="text-xs text-muted">รูปใหม่จะถูกบันทึกเมื่อกดบันทึก</span>}
        {error && <span className="text-xs text-loss">{error}</span>}
      </div>
    </div>
  );
}
