import "server-only";
import { del, put } from "@vercel/blob";

/**
 * เก็บรูปนักเตะ/ทีมงานใน Vercel Blob
 *
 * เบราว์เซอร์ย่อรูปเป็น JPEG สี่เหลี่ยมจัตุรัสมาให้แล้ว (ดู PlayerPhotoInput) จึงรับเป็น data URL
 * ขนาดเล็ก ๆ ผ่าน server action ได้เลย ไม่ต้องทำ endpoint อัปโหลดแยก
 */
const MAX_BYTES = 600 * 1024;
const BLOB_HOST = ".blob.vercel-storage.com";

export function photoStorageReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** อัปโหลดรูปแล้วคืน URL — name เช่น "players/somchai" · ข้อมูลไม่ถูกต้องจะ throw พร้อมข้อความภาษาไทย */
export async function uploadPhoto(dataUrl: string, name: string): Promise<string> {
  if (!photoStorageReady()) throw new Error("ยังไม่ได้ตั้งค่าที่เก็บรูป (BLOB_READ_WRITE_TOKEN)");

  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("ไฟล์รูปไม่ถูกต้อง");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_BYTES) throw new Error("รูปใหญ่เกินไป");

  // ชื่อไฟล์สุ่มต่อท้ายทุกครั้ง เปลี่ยนรูปแล้วเบราว์เซอร์/CDN จะไม่ค้างรูปเก่า
  const blob = await put(`${name}.jpg`, bytes, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });
  return blob.url;
}

/** ลบรูปเก่า — เฉพาะรูปที่อยู่ใน Blob ของเราเอง (URL ที่กรอกจากเว็บอื่นไม่แตะ) และไม่ให้ error ไปขวางการบันทึก */
export async function deletePhoto(url: string | null | undefined) {
  if (!url || !url.includes(BLOB_HOST) || !photoStorageReady()) return;
  try {
    await del(url);
  } catch (err) {
    console.error("ลบรูปเก่าไม่สำเร็จ", err);
  }
}
