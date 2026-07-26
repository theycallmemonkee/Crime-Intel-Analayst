// Populates Neo4j from the *existing* Postgres data — unlike
// prisma/seed.ts's main(), this never touches Postgres. That script
// regenerates a brand-new random dataset and deletes everything first,
// which is fine for a fresh local dev database but would wipe live
// production data (including real users) if ever run against it.
//
// Use this instead whenever Neo4j needs (re)populating but Postgres
// already has the data it should mirror — e.g. after provisioning a new
// Neo4j instance for an environment where Postgres is already seeded.
//
// Usage: NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... DATABASE_URL=... \
//   npx ts-node --transpile-only scripts/seed-neo4j-from-postgres.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedNeo4j } from '../src/database/synthetic/seed-neo4j';
import { SyntheticDataset } from '../src/database/synthetic/generator';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading current data from Postgres (read-only)...');

  const [stations, persons, vehicles, weapons, crimes, crimePersons, crimeVehicles, crimeWeapons] =
    await Promise.all([
      prisma.policeStation.findMany({ select: { id: true, name: true, code: true } }),
      prisma.person.findMany({
        select: { id: true, fullName: true, alias: true, gender: true, phoneNumber: true, addressLine: true },
      }),
      prisma.vehicle.findMany({
        select: { id: true, registrationNumber: true, type: true, ownerPersonId: true },
      }),
      prisma.weapon.findMany({ select: { id: true, type: true } }),
      prisma.crime.findMany({ select: { id: true, status: true, occurredAt: true, stationId: true } }),
      prisma.crimePerson.findMany({ select: { id: true, crimeId: true, personId: true, role: true } }),
      prisma.crimeVehicle.findMany({ select: { id: true, crimeId: true, vehicleId: true, role: true } }),
      prisma.crimeWeapon.findMany({ select: { id: true, crimeId: true, weaponId: true } }),
    ]);

  console.log(
    `Loaded ${stations.length} stations, ${persons.length} persons, ${vehicles.length} vehicles, ` +
      `${weapons.length} weapons, ${crimes.length} crimes, ${crimePersons.length} crime-person links, ` +
      `${crimeVehicles.length} crime-vehicle links, ${crimeWeapons.length} crime-weapon links.`,
  );

  // seedNeo4j (see src/database/synthetic/seed-neo4j.ts) only reads
  // stations.{id,name,code}, persons.{id,fullName,alias,gender,
  // phoneNumber,addressLine}, vehicles.{id,registrationNumber,type,
  // ownerPersonId}, weapons.{id,type}, crimes.{id,status,occurredAt,
  // stationId}, and the three crime-link join tables — confirmed by
  // reading its implementation, not assumed. SyntheticDataset requires
  // more fields than that (districts, categories, users, firs, evidence,
  // plus a few unused ones on the types above) because it's shared with
  // the synthetic generator; asserting past that here is safe rather than
  // fetching Postgres columns this script has no use for.
  const data = {
    districts: [],
    categories: [],
    users: [],
    firs: [],
    evidence: [],
    stations,
    persons,
    vehicles,
    weapons,
    crimes,
    crimePersons,
    crimeVehicles,
    crimeWeapons,
  } as unknown as SyntheticDataset;

  await seedNeo4j(data);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
