import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { themeByThaiTime } from "@/lib/theme";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Artist FC",
    template: "%s · Artist FC",
  },
  description: "ตารางคะแนน โปรแกรมการแข่งขัน และสถิติผู้เล่นของ Artist FC",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // เผื่อจอมีรอยบาก
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // คำนวณธีมจากเวลาไทยตั้งแต่ฝั่งเซิร์ฟเวอร์ หน้าเว็บจะได้ไม่กะพริบตอนโหลด
  const theme = themeByThaiTime();

  return (
    <html
      lang="th"
      data-theme={theme}
      className={`${notoThai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
