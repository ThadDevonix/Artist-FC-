-- CreateEnum
CREATE TYPE "LivePhase" AS ENUM ('FIRST_HALF', 'HALF_TIME', 'SECOND_HALF');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "livePhase" "LivePhase",
ADD COLUMN     "phaseStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "halfMinutes" INTEGER NOT NULL DEFAULT 45;
