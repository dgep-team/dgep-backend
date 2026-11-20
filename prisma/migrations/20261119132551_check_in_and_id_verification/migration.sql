-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('NIN', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTERS_CARD');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "arrivalTime" TEXT,
ADD COLUMN     "onlineCheckInAt" TIMESTAMP(3),
ADD COLUMN     "specialRequests" TEXT;

-- CreateTable
CREATE TABLE "id_verifications" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "idType" "IdType" NOT NULL,
    "idNumber" TEXT NOT NULL,
    "idImageKey" TEXT NOT NULL,
    "selfieKey" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "id_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "id_verifications_bookingId_key" ON "id_verifications"("bookingId");

-- AddForeignKey
ALTER TABLE "id_verifications" ADD CONSTRAINT "id_verifications_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
