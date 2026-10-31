-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "githubId" TEXT;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

