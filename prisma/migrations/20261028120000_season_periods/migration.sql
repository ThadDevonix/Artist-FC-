-- ฤดูกาลเลือกจำนวนช่วงได้ (ครึ่ง/ควอเตอร์) — คอลัมน์ halfMinutes เดิมใช้เป็นนาทีต่อช่วง
ALTER TABLE "Season" ADD COLUMN "periods" INTEGER NOT NULL DEFAULT 2;

-- นัดที่กำลังแข่งเก็บเป็นเลขช่วง + พักหรือไม่ แทน enum ครึ่งแรก/พักครึ่ง/ครึ่งหลัง
ALTER TABLE "Match" ADD COLUMN "livePeriod" INTEGER,
ADD COLUMN "liveBreak" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Match" SET "livePeriod" = 1, "liveBreak" = false WHERE "livePhase" = 'FIRST_HALF';
UPDATE "Match" SET "livePeriod" = 1, "liveBreak" = true WHERE "livePhase" = 'HALF_TIME';
UPDATE "Match" SET "livePeriod" = 2, "liveBreak" = false WHERE "livePhase" = 'SECOND_HALF';

ALTER TABLE "Match" DROP COLUMN "livePhase";
DROP TYPE "LivePhase";
