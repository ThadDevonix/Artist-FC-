-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('PRESIDENT', 'MANAGER', 'HEAD_COACH', 'ASSISTANT_COACH', 'GK_COACH', 'FITNESS_COACH', 'DOCTOR', 'PHYSIO', 'TEAM_OFFICER', 'OTHER');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "roleLabel" TEXT,
    "photoUrl" TEXT,
    "nationality" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staff_teamId_idx" ON "Staff"("teamId");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
