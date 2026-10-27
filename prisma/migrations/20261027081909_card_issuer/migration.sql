-- AlterTable
ALTER TABLE "MatchEvent" ADD COLUMN     "issuedById" TEXT;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;
