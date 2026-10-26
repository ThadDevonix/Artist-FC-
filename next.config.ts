import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ทุกหน้าอ่านข้อมูลสดจากฐานข้อมูล (ตารางคะแนน ผลแข่ง สถิติ เปลี่ยนตลอด)
  // จึงปิด cacheComponents/PPR ไว้ — เปิดแล้วต้องห่อ Suspense ทุกจุดโดยไม่ได้ประโยชน์
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
