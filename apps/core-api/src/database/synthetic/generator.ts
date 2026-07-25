import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import {
  CRIME_CATEGORIES,
  DISTRICTS,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
  LAST_NAMES,
  STATION_SUFFIXES,
  VEHICLE_TYPES,
  WEAPON_TYPES,
} from './karnataka-data';

// Deterministic seed: every `npm run db:seed` produces the same dataset,
// which makes the demo reproducible and bug reports comparable.
faker.seed(42);

const CRIME_COUNT = 900;
const PERSON_COUNT = 320;
const VEHICLE_COUNT = 130;
const WEAPON_COUNT = 45;
const YEARS_OF_HISTORY = 3;

export type GenderValue = 'MALE' | 'FEMALE' | 'OTHER';
export type CrimePersonRoleValue = 'SUSPECT' | 'VICTIM' | 'WITNESS';
export type VehicleInvolvementRoleValue = 'USED_IN_CRIME' | 'GETAWAY' | 'STOLEN';
export type InvestigationStatusValue = 'REPORTED' | 'UNDER_INVESTIGATION' | 'CHARGESHEETED' | 'CLOSED';
export type EvidenceTypeValue = 'PHOTO' | 'DOCUMENT' | 'DIGITAL' | 'PHYSICAL_OBJECT' | 'OTHER';
export type RoleValue = 'ADMIN' | 'ANALYST' | 'OFFICER';

export interface GeneratedDistrict {
  id: string;
  name: string;
  code: string;
}

export interface GeneratedStation {
  id: string;
  name: string;
  code: string;
  districtId: string;
  latitude: number;
  longitude: number;
}

export interface GeneratedCategory {
  id: string;
  name: string;
  severityWeight: number;
}

export interface GeneratedUser {
  id: string;
  username: string;
  password: string; // plaintext here — hashed at Postgres-insert time
  fullName: string;
  role: RoleValue;
  districtId: string | null;
  stationId: string | null;
}

export interface GeneratedPerson {
  id: string;
  fullName: string;
  alias: string | null;
  gender: GenderValue;
  dateOfBirth: Date;
  phoneNumber: string | null;
  addressLine: string | null;
}

export interface GeneratedVehicle {
  id: string;
  registrationNumber: string;
  type: string;
  color: string | null;
  ownerPersonId: string | null;
}

export interface GeneratedWeapon {
  id: string;
  type: string;
  description: string | null;
  serialNumber: string | null;
}

export interface GeneratedCrime {
  id: string;
  categoryId: string;
  districtId: string;
  stationId: string;
  occurredAt: Date;
  reportedAt: Date;
  status: InvestigationStatusValue;
  description: string;
  addressLine: string;
  latitude: number;
  longitude: number;
}

export interface GeneratedFir {
  id: string;
  firNumber: string;
  crimeId: string;
  filedById: string;
  narrative: string;
  dateFiled: Date;
}

export interface GeneratedCrimePerson {
  id: string;
  crimeId: string;
  personId: string;
  role: CrimePersonRoleValue;
}

export interface GeneratedCrimeVehicle {
  id: string;
  crimeId: string;
  vehicleId: string;
  role: VehicleInvolvementRoleValue;
}

export interface GeneratedCrimeWeapon {
  id: string;
  crimeId: string;
  weaponId: string;
}

export interface GeneratedEvidence {
  id: string;
  crimeId: string;
  type: EvidenceTypeValue;
  description: string;
  collectedById: string;
  collectedAt: Date;
  fileHash: string | null;
}

export interface SyntheticDataset {
  districts: GeneratedDistrict[];
  stations: GeneratedStation[];
  categories: GeneratedCategory[];
  users: GeneratedUser[];
  persons: GeneratedPerson[];
  vehicles: GeneratedVehicle[];
  weapons: GeneratedWeapon[];
  crimes: GeneratedCrime[];
  firs: GeneratedFir[];
  crimePersons: GeneratedCrimePerson[];
  crimeVehicles: GeneratedCrimeVehicle[];
  crimeWeapons: GeneratedCrimeWeapon[];
  evidence: GeneratedEvidence[];
}

function fullName(): { name: string; gender: GenderValue } {
  const isMale = faker.datatype.boolean();
  const first = faker.helpers.arrayElement(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
  const last = faker.helpers.arrayElement(LAST_NAMES);
  return { name: `${first} ${last}`, gender: isMale ? 'MALE' : 'FEMALE' };
}

function jitter(coord: number, spreadDegrees = 0.15): number {
  return coord + (faker.number.float({ min: -1, max: 1 }) * spreadDegrees);
}

function randomPastDate(years: number): Date {
  return faker.date.past({ years });
}

function weightedStatus(occurredAt: Date): InvestigationStatusValue {
  const ageDays = (Date.now() - occurredAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 30) {
    return faker.helpers.weightedArrayElement([
      { value: 'REPORTED', weight: 5 },
      { value: 'UNDER_INVESTIGATION', weight: 3 },
      { value: 'CHARGESHEETED', weight: 1 },
      { value: 'CLOSED', weight: 1 },
    ]);
  }
  if (ageDays < 180) {
    return faker.helpers.weightedArrayElement([
      { value: 'REPORTED', weight: 1 },
      { value: 'UNDER_INVESTIGATION', weight: 4 },
      { value: 'CHARGESHEETED', weight: 3 },
      { value: 'CLOSED', weight: 2 },
    ]);
  }
  return faker.helpers.weightedArrayElement([
    { value: 'UNDER_INVESTIGATION', weight: 1 },
    { value: 'CHARGESHEETED', weight: 2 },
    { value: 'CLOSED', weight: 6 },
  ]);
}

export function generateSyntheticDataset(): SyntheticDataset {
  // --- Districts & Stations -------------------------------------------------
  const districts: GeneratedDistrict[] = DISTRICTS.map((d) => ({
    id: randomUUID(),
    name: d.name,
    code: d.code,
  }));

  const stations: GeneratedStation[] = [];
  DISTRICTS.forEach((d, i) => {
    const districtId = districts[i].id;
    STATION_SUFFIXES.forEach((suffix) => {
      stations.push({
        id: randomUUID(),
        name: `${d.name} ${suffix} PS`,
        code: `${d.code}-${suffix.toUpperCase()}`,
        districtId,
        latitude: jitter(d.latitude, 0.08),
        longitude: jitter(d.longitude, 0.08),
      });
    });
  });

  // --- Crime categories ------------------------------------------------------
  const categories: GeneratedCategory[] = CRIME_CATEGORIES.map((c) => ({
    id: randomUUID(),
    name: c.name,
    severityWeight: c.severityWeight,
  }));

  // --- Users (3 roles; 2 Officers at different stations to demo scoping) ----
  const officerStationA = stations[0];
  const officerStationB = stations[2];
  const users: GeneratedUser[] = [
    {
      id: randomUUID(),
      username: 'admin',
      password: 'Admin@123',
      fullName: 'SCRB Administrator',
      role: 'ADMIN',
      districtId: null,
      stationId: null,
    },
    {
      id: randomUUID(),
      username: 'analyst',
      password: 'Analyst@123',
      fullName: 'SCRB Intelligence Analyst',
      role: 'ANALYST',
      districtId: null,
      stationId: null,
    },
    {
      id: randomUUID(),
      username: 'officer.blr',
      password: 'Officer@123',
      fullName: 'Investigating Officer (Bengaluru Urban Town PS)',
      role: 'OFFICER',
      districtId: officerStationA.districtId,
      stationId: officerStationA.id,
    },
    {
      id: randomUUID(),
      username: 'officer.mys',
      password: 'Officer@123',
      fullName: 'Investigating Officer (Dakshina Kannada Town PS)',
      role: 'OFFICER',
      districtId: officerStationB.districtId,
      stationId: officerStationB.id,
    },
  ];

  // --- Persons ----------------------------------------------------------------
  // A subset deliberately shares addresses/phone numbers (households, gang
  // "safe houses") and a subset is a repeat-offender pool reused as SUSPECT
  // across multiple crimes — this is what makes Milestone 6 (network/link
  // analysis: hidden associations, gang detection, repeat offenders) findable
  // in the generated data rather than everything being independently random.
  const persons: GeneratedPerson[] = [];
  const sharedAddressPool = Array.from({ length: 40 }, () => faker.location.streetAddress());
  const sharedPhonePool = Array.from({ length: 15 }, () =>
    `9${faker.string.numeric(9)}`,
  );

  for (let i = 0; i < PERSON_COUNT; i++) {
    const { name, gender } = fullName();
    const useSharedAddress = faker.number.int({ min: 0, max: 100 }) < 45;
    const useSharedPhone = faker.number.int({ min: 0, max: 100 }) < 12;
    persons.push({
      id: randomUUID(),
      fullName: name,
      alias: faker.number.int({ min: 0, max: 100 }) < 10 ? faker.person.firstName() : null,
      gender,
      dateOfBirth: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
      phoneNumber: useSharedPhone
        ? faker.helpers.arrayElement(sharedPhonePool)
        : `9${faker.string.numeric(9)}`,
      addressLine: useSharedAddress
        ? faker.helpers.arrayElement(sharedAddressPool)
        : faker.location.streetAddress(),
    });
  }

  // Repeat-offender pool: ~18 persons who show up as SUSPECT far more often.
  const repeatOffenderPool = faker.helpers.arrayElements(persons, 18);

  // --- Vehicles -----------------------------------------------------------
  const vehicles: GeneratedVehicle[] = [];
  for (let i = 0; i < VEHICLE_COUNT; i++) {
    const districtIndex = faker.number.int({ min: 0, max: DISTRICTS.length - 1 });
    const rtoCode = String(districtIndex + 1).padStart(2, '0');
    const owner = faker.number.int({ min: 0, max: 100 }) < 70 ? faker.helpers.arrayElement(persons) : null;
    vehicles.push({
      id: randomUUID(),
      registrationNumber: `KA${rtoCode}${faker.string.alpha({ length: 2, casing: 'upper' })}${faker.string.numeric(4)}`,
      type: faker.helpers.arrayElement(VEHICLE_TYPES),
      color: faker.color.human(),
      ownerPersonId: owner ? owner.id : null,
    });
  }

  // --- Weapons --------------------------------------------------------------
  const weapons: GeneratedWeapon[] = Array.from({ length: WEAPON_COUNT }, () => ({
    id: randomUUID(),
    type: faker.helpers.arrayElement(WEAPON_TYPES),
    description: faker.lorem.sentence(6),
    serialNumber: faker.number.int({ min: 0, max: 100 }) < 20 ? faker.string.alphanumeric(10).toUpperCase() : null,
  }));

  // --- Crimes, FIRs, and links -----------------------------------------------
  const crimes: GeneratedCrime[] = [];
  const firs: GeneratedFir[] = [];
  const crimePersons: GeneratedCrimePerson[] = [];
  const crimeVehicles: GeneratedCrimeVehicle[] = [];
  const crimeWeapons: GeneratedCrimeWeapon[] = [];
  const evidence: GeneratedEvidence[] = [];

  const firSequenceByStation = new Map<string, number>();

  for (let i = 0; i < CRIME_COUNT; i++) {
    const station = faker.helpers.arrayElement(stations);
    const category = faker.helpers.arrayElement(categories);
    const occurredAt = randomPastDate(YEARS_OF_HISTORY);
    const reportedAt = new Date(occurredAt.getTime() + faker.number.int({ min: 0, max: 3 }) * 86_400_000);
    const status = weightedStatus(occurredAt);

    const crime: GeneratedCrime = {
      id: randomUUID(),
      categoryId: category.id,
      districtId: station.districtId,
      stationId: station.id,
      occurredAt,
      reportedAt,
      status,
      description: `${category.name} reported: ${faker.lorem.sentence(10)}`,
      addressLine: faker.location.streetAddress(),
      latitude: jitter(station.latitude, 0.03),
      longitude: jitter(station.longitude, 0.03),
    };
    crimes.push(crime);

    // FIR (one per crime)
    const seq = (firSequenceByStation.get(station.id) ?? 0) + 1;
    firSequenceByStation.set(station.id, seq);
    const filedBy = faker.helpers.arrayElement(
      users.filter((u) => u.role === 'OFFICER' || u.role === 'ADMIN'),
    );
    firs.push({
      id: randomUUID(),
      firNumber: `${station.code}/${occurredAt.getFullYear()}/${String(seq).padStart(4, '0')}`,
      crimeId: crime.id,
      filedById: filedBy.id,
      narrative: faker.lorem.paragraph(4),
      dateFiled: reportedAt,
    });

    // Suspects (1-2, distinct), biased toward the repeat-offender pool
    const suspectCount = faker.number.int({ min: 1, max: 2 });
    const suspectIds = new Set<string>();
    for (let s = 0; s < suspectCount; s++) {
      const useRepeat = faker.number.int({ min: 0, max: 100 }) < 40;
      let person = useRepeat
        ? faker.helpers.arrayElement(repeatOffenderPool)
        : faker.helpers.arrayElement(persons);
      if (suspectIds.has(person.id)) {
        person = faker.helpers.arrayElement(persons.filter((p) => !suspectIds.has(p.id)));
      }
      suspectIds.add(person.id);
      crimePersons.push({ id: randomUUID(), crimeId: crime.id, personId: person.id, role: 'SUSPECT' });
    }

    // Victims (1)
    const victim = faker.helpers.arrayElement(persons);
    crimePersons.push({ id: randomUUID(), crimeId: crime.id, personId: victim.id, role: 'VICTIM' });

    // Witnesses (0-2, distinct)
    const witnessCount = faker.number.int({ min: 0, max: 2 });
    const witnessIds = new Set<string>();
    for (let w = 0; w < witnessCount; w++) {
      let witness = faker.helpers.arrayElement(persons);
      if (witnessIds.has(witness.id)) {
        witness = faker.helpers.arrayElement(persons.filter((p) => !witnessIds.has(p.id)));
      }
      witnessIds.add(witness.id);
      crimePersons.push({ id: randomUUID(), crimeId: crime.id, personId: witness.id, role: 'WITNESS' });
    }

    // Vehicle involvement (~50%)
    if (faker.number.int({ min: 0, max: 100 }) < 50) {
      const vehicle = faker.helpers.arrayElement(vehicles);
      crimeVehicles.push({
        id: randomUUID(),
        crimeId: crime.id,
        vehicleId: vehicle.id,
        role: faker.helpers.arrayElement(['USED_IN_CRIME', 'GETAWAY', 'STOLEN']),
      });
    }

    // Weapon involvement (~35%)
    if (faker.number.int({ min: 0, max: 100 }) < 35) {
      const weapon = faker.helpers.arrayElement(weapons);
      crimeWeapons.push({ id: randomUUID(), crimeId: crime.id, weaponId: weapon.id });
    }

    // Evidence (1-3 items)
    const evidenceCount = faker.number.int({ min: 1, max: 3 });
    const collector = faker.helpers.arrayElement(users.filter((u) => u.role === 'OFFICER'));
    for (let e = 0; e < evidenceCount; e++) {
      evidence.push({
        id: randomUUID(),
        crimeId: crime.id,
        type: faker.helpers.arrayElement(['PHOTO', 'DOCUMENT', 'DIGITAL', 'PHYSICAL_OBJECT', 'OTHER']),
        description: faker.lorem.sentence(8),
        collectedById: collector.id,
        collectedAt: new Date(reportedAt.getTime() + faker.number.int({ min: 0, max: 5 }) * 86_400_000),
        fileHash: faker.string.hexadecimal({ length: 64, casing: 'lower', prefix: '' }),
      });
    }
  }

  return {
    districts,
    stations,
    categories,
    users,
    persons,
    vehicles,
    weapons,
    crimes,
    firs,
    crimePersons,
    crimeVehicles,
    crimeWeapons,
    evidence,
  };
}
