-- Add-ons such as airport pickup and breakfast (PRD AO-01, AO-02)
-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "addOns" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "addOns" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "guests" INTEGER NOT NULL DEFAULT 1;
