-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANALYST', 'OFFICER');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('REPORTED', 'UNDER_INVESTIGATION', 'CHARGESHEETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "CrimePersonRole" AS ENUM ('SUSPECT', 'VICTIM', 'WITNESS');

-- CreateEnum
CREATE TYPE "VehicleInvolvementRole" AS ENUM ('USED_IN_CRIME', 'GETAWAY', 'STOLEN');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PHOTO', 'DOCUMENT', 'DIGITAL', 'PHYSICAL_OBJECT', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "districtId" TEXT,
    "stationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliceStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PoliceStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CrimeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crime" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'REPORTED',
    "description" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fir" (
    "id" TEXT NOT NULL,
    "firNumber" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "filedById" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "dateFiled" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "alias" TEXT,
    "gender" "Gender" NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "addressLine" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimePerson" (
    "id" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "CrimePersonRole" NOT NULL,

    CONSTRAINT "CrimePerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT,
    "ownerPersonId" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeVehicle" (
    "id" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "role" "VehicleInvolvementRole" NOT NULL,

    CONSTRAINT "CrimeVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Weapon" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "serialNumber" TEXT,

    CONSTRAINT "Weapon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeWeapon" (
    "id" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "weaponId" TEXT NOT NULL,

    CONSTRAINT "CrimeWeapon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "crimeId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "description" TEXT NOT NULL,
    "collectedById" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileHash" TEXT,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "District_name_key" ON "District"("name");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PoliceStation_code_key" ON "PoliceStation"("code");

-- CreateIndex
CREATE INDEX "PoliceStation_districtId_idx" ON "PoliceStation"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeCategory_name_key" ON "CrimeCategory"("name");

-- CreateIndex
CREATE INDEX "Crime_districtId_idx" ON "Crime"("districtId");

-- CreateIndex
CREATE INDEX "Crime_stationId_idx" ON "Crime"("stationId");

-- CreateIndex
CREATE INDEX "Crime_categoryId_idx" ON "Crime"("categoryId");

-- CreateIndex
CREATE INDEX "Crime_occurredAt_idx" ON "Crime"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Fir_firNumber_key" ON "Fir"("firNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Fir_crimeId_key" ON "Fir"("crimeId");

-- CreateIndex
CREATE INDEX "Person_phoneNumber_idx" ON "Person"("phoneNumber");

-- CreateIndex
CREATE INDEX "Person_fullName_idx" ON "Person"("fullName");

-- CreateIndex
CREATE INDEX "CrimePerson_personId_idx" ON "CrimePerson"("personId");

-- CreateIndex
CREATE INDEX "CrimePerson_crimeId_idx" ON "CrimePerson"("crimeId");

-- CreateIndex
CREATE UNIQUE INDEX "CrimePerson_crimeId_personId_role_key" ON "CrimePerson"("crimeId", "personId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeVehicle_crimeId_vehicleId_key" ON "CrimeVehicle"("crimeId", "vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeWeapon_crimeId_weaponId_key" ON "CrimeWeapon"("crimeId", "weaponId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "PoliceStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliceStation" ADD CONSTRAINT "PoliceStation_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crime" ADD CONSTRAINT "Crime_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CrimeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crime" ADD CONSTRAINT "Crime_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crime" ADD CONSTRAINT "Crime_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "PoliceStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fir" ADD CONSTRAINT "Fir_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fir" ADD CONSTRAINT "Fir_filedById_fkey" FOREIGN KEY ("filedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimePerson" ADD CONSTRAINT "CrimePerson_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimePerson" ADD CONSTRAINT "CrimePerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeVehicle" ADD CONSTRAINT "CrimeVehicle_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeVehicle" ADD CONSTRAINT "CrimeVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeWeapon" ADD CONSTRAINT "CrimeWeapon_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrimeWeapon" ADD CONSTRAINT "CrimeWeapon_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "Weapon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "Crime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
