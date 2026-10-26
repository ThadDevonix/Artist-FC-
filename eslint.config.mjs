import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),

  /**
   * กฎโครงสร้าง: src/lib ต้องเป็นตรรกะบริสุทธิ์
   *
   * ห้ามแตะฐานข้อมูล session หรือ React
   * เพื่อให้เทสต์กฎธุรกิจ (ตารางคะแนน ตารางแข่ง ธีม) ได้โดยไม่ต้องมี DB หรือเบราว์เซอร์
   * ถ้าวันหนึ่งเผลอ import เข้ามา ESLint จะฟ้องทันทีแทนที่จะรู้ตัวตอนเทสต์ช้าลง
   */
  {
    files: ["src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "@/server", "@/components/*", "@/app/*"],
              message:
                "src/lib ต้องเป็นตรรกะบริสุทธิ์ — ถ้าต้องใช้ฐานข้อมูลให้ย้ายไฟล์ไป src/server/queries แทน",
            },
            {
              group: ["react", "react-dom", "next/*"],
              message:
                "src/lib ต้องใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และสคริปต์เทสต์ — โค้ดที่ผูกกับ React ให้อยู่ใน src/components",
            },
          ],
        },
      ],
    },
  },

  /**
   * กฎโครงสร้าง: หน้าเพจห้ามเรียกฐานข้อมูลตรง ๆ
   * ต้องผ่าน src/server/queries เพื่อให้ query ถูกใช้ซ้ำได้และแก้ที่เดียว
   */
  {
    files: ["src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/db",
              message:
                "หน้าเพจไม่ควรเรียก db ตรง ๆ — เขียน query ไว้ใน src/server/queries แล้ว import จากที่นั่น",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
