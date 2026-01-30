-- AlterTable
ALTER TABLE "User" ADD COLUMN "hashedRt" TEXT;
ALTER TABLE "User" ADD COLUMN "otp" TEXT;
ALTER TABLE "User" ADD COLUMN "otpExpiry" DATETIME;

-- CreateTable
CREATE TABLE "BlacklistedToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");
