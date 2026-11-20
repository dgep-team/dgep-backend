-- Logins (SCRUM-27): guest and staff passwords, and the platform team.
-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");
