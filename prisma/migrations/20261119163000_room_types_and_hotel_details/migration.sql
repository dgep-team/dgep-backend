-- Room types (PRD BR-04, BR-05) and hotel listing details (BR-02, BR-06, PC-05).
-- Written by hand so existing rooms keep their type and price: each
-- (hotel, type, price) becomes a room type, and its rooms point to it.

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "arrivalInstructions" TEXT,
ADD COLUMN     "checkInTime" TEXT NOT NULL DEFAULT '14:00',
ADD COLUMN     "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "parkingInfo" TEXT,
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "taxes" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "room_types" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bedType" TEXT NOT NULL,
    "maxGuests" INTEGER NOT NULL,
    "sizeSqm" INTEGER,
    "view" TEXT,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessibility" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pricePerNight" INTEGER NOT NULL,
    "cancellationPolicy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "room_types_hotelId_name_key" ON "room_types"("hotelId", "name");

-- 1. One room type per hotel + old type name (the highest price wins if they differ)
INSERT INTO "room_types" ("id", "hotelId", "name", "bedType", "maxGuests", "pricePerNight", "updatedAt")
SELECT gen_random_uuid()::text, "hotelId", "type", 'To be added', 2, MAX("pricePerNight"), CURRENT_TIMESTAMP
FROM "rooms"
GROUP BY "hotelId", "type";

-- 2. Link each room to its new room type, then make the link required
ALTER TABLE "rooms" ADD COLUMN "roomTypeId" TEXT;
UPDATE "rooms" r SET "roomTypeId" = rt."id"
FROM "room_types" rt
WHERE rt."hotelId" = r."hotelId" AND rt."name" = r."type";
ALTER TABLE "rooms" ALTER COLUMN "roomTypeId" SET NOT NULL;

-- 3. The type and price now live on the room type
ALTER TABLE "rooms" DROP COLUMN "pricePerNight", DROP COLUMN "type";

CREATE INDEX "rooms_roomTypeId_idx" ON "rooms"("roomTypeId");
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
