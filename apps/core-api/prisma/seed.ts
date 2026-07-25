import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateSyntheticDataset } from '../src/database/synthetic/generator';
import { seedNeo4j } from '../src/database/synthetic/seed-neo4j';

const prisma = new PrismaClient();

async function resetPostgres() {
  // Reverse FK-dependency order.
  await prisma.evidence.deleteMany();
  await prisma.crimeWeapon.deleteMany();
  await prisma.crimeVehicle.deleteMany();
  await prisma.crimePerson.deleteMany();
  await prisma.fir.deleteMany();
  await prisma.crime.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.weapon.deleteMany();
  await prisma.person.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.crimeCategory.deleteMany();
  await prisma.policeStation.deleteMany();
  await prisma.district.deleteMany();
}

async function seedPostgres() {
  console.log('Generating synthetic dataset...');
  const data = generateSyntheticDataset();

  console.log('Resetting existing data...');
  await resetPostgres();

  console.log('Seeding districts & stations...');
  await prisma.district.createMany({ data: data.districts });
  await prisma.policeStation.createMany({ data: data.stations });

  console.log('Seeding crime categories...');
  await prisma.crimeCategory.createMany({ data: data.categories });

  console.log('Seeding persons, vehicles, weapons...');
  await prisma.person.createMany({ data: data.persons });
  await prisma.vehicle.createMany({ data: data.vehicles });
  await prisma.weapon.createMany({ data: data.weapons });

  console.log('Seeding users (Admin / Analyst / Officer)...');
  const usersWithHashedPasswords = await Promise.all(
    data.users.map(async (u) => ({
      id: u.id,
      username: u.username,
      passwordHash: await bcrypt.hash(u.password, 10),
      fullName: u.fullName,
      role: u.role,
      districtId: u.districtId,
      stationId: u.stationId,
    })),
  );
  await prisma.user.createMany({ data: usersWithHashedPasswords });

  console.log(`Seeding ${data.crimes.length} crimes and related records...`);
  await prisma.crime.createMany({ data: data.crimes });
  await prisma.fir.createMany({ data: data.firs });
  await prisma.crimePerson.createMany({ data: data.crimePersons, skipDuplicates: true });
  await prisma.crimeVehicle.createMany({ data: data.crimeVehicles, skipDuplicates: true });
  await prisma.crimeWeapon.createMany({ data: data.crimeWeapons, skipDuplicates: true });
  await prisma.evidence.createMany({ data: data.evidence });

  console.log('Postgres seed complete.');
  return data;
}

async function main() {
  const data = await seedPostgres();
  await seedNeo4j(data);
  console.log('\nSeed users (username / password):');
  data.users.forEach((u) => console.log(`  ${u.role.padEnd(8)} ${u.username.padEnd(14)} ${u.password}`));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
