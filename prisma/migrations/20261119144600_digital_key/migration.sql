-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "keyCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_keyCode_key" ON "bookings"("keyCode");
