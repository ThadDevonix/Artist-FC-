-- ฤดูกาลแบบแบ่งกลุ่ม + น็อคเอาต์: กลุ่มของทีม, ข้อมูลรอบของนัด, ผลจุดโทษ และการตั้งค่าต่อเวลา/จุดโทษ
-- CreateEnum
CREATE TYPE "SeasonFormat" AS ENUM ('LEAGUE', 'CUP');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "awayPens" INTEGER,
ADD COLUMN     "awaySource" TEXT,
ADD COLUMN     "group" INTEGER,
ADD COLUMN     "homePens" INTEGER,
ADD COLUMN     "homeSource" TEXT,
ADD COLUMN     "koSize" INTEGER,
ADD COLUMN     "koSlot" INTEGER,
ADD COLUMN     "leg" INTEGER;

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "advancePerGroup" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "extraTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "extraTimeMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "format" "SeasonFormat" NOT NULL DEFAULT 'LEAGUE',
ADD COLUMN     "groupCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "knockoutLegs" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "penalties" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SeasonTeam" ADD COLUMN     "group" INTEGER;

