-- AlterTable
ALTER TABLE "Match" ALTER COLUMN "kickoffAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SeasonTeam" ADD COLUMN     "slot" INTEGER;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "isPlaceholder" BOOLEAN NOT NULL DEFAULT false;
