-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_refereeId_fkey";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "assistant1Id" TEXT,
ADD COLUMN     "assistant2Id" TEXT,
ADD COLUMN     "fourthOfficialId" TEXT;

-- CreateTable
CREATE TABLE "Official" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "nationality" TEXT,
    "photoUrl" TEXT,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Official_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Official_userId_key" ON "Official"("userId");

-- AddForeignKey
ALTER TABLE "Official" ADD CONSTRAINT "Official_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ย้ายข้อมูลเดิม: Match.refereeId เคยชี้ไปที่ User (บัญชีกรรมการ) ตอนนี้ชี้ไปที่ Official
-- สร้างผู้ตัดสินให้บัญชีกรรมการทุกคน (และใครก็ตามที่เคยถูกตั้งเป็นผู้ตัดสินของนัด) ผูกกับบัญชีเดิม
INSERT INTO "Official" ("id", "name", "userId", "updatedAt")
SELECT 'off_' || u."id", u."name", u."id", CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'REFEREE'
   OR u."id" IN (SELECT "refereeId" FROM "Match" WHERE "refereeId" IS NOT NULL);

UPDATE "Match" SET "refereeId" = 'off_' || "refereeId" WHERE "refereeId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_assistant1Id_fkey" FOREIGN KEY ("assistant1Id") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_assistant2Id_fkey" FOREIGN KEY ("assistant2Id") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_fourthOfficialId_fkey" FOREIGN KEY ("fourthOfficialId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;
