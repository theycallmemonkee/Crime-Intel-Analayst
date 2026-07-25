import neo4j from 'neo4j-driver';
import { SyntheticDataset } from './generator';

// ---------------------------------------------------------------------------
// Neo4j graph model
//
// Nodes:   Person, Crime, Vehicle, Weapon, PhoneNumber, Address, PoliceStation
// Relationships:
//   (Person)-[:INVOLVED_IN {role}]->(Crime)         suspect/victim/witness
//   (Crime)-[:OCCURRED_AT]->(PoliceStation)
//   (Crime)-[:USED_VEHICLE {role}]->(Vehicle)
//   (Crime)-[:USED_WEAPON]->(Weapon)
//   (Person)-[:OWNS_VEHICLE]->(Vehicle)
//   (Person)-[:HAS_PHONE]->(PhoneNumber)             shared PhoneNumber node
//                                                     is how two people are
//                                                     linked by a common number
//   (Person)-[:HAS_ADDRESS]->(Address)               shared Address node is
//                                                     how households/gang
//                                                     "safe houses" surface
//   (Person)-[:CO_SUSPECT {sharedCrimeCount}]-(Person)  derived edge: two
//                                                     people who were both
//                                                     SUSPECT on the same
//                                                     crime at least once.
//                                                     Materialized here
//                                                     (not computed on every
//                                                     request) specifically
//                                                     because Milestone 6's
//                                                     gang/community detection
//                                                     runs a GDS graph
//                                                     algorithm over it, and
//                                                     algorithms project a
//                                                     real relationship type,
//                                                     not a derived pattern.
//
// PhoneNumber/Address are deliberately modeled as their own nodes (not
// properties on Person) — a shared node is exactly what makes "two suspects
// used the same phone number" a one-hop graph pattern instead of a
// string-equality scan. This is the crux of Milestone 6 (hidden associations,
// repeat offenders, gang networks): Postgres stores identity and the crime
// record system-of-truth, Neo4j stores who's connected to whom and how.
// ---------------------------------------------------------------------------

function batches<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function seedNeo4j(data: SyntheticDataset) {
  const driver = neo4j.driver(
    process.env.NEO4J_URI ?? 'bolt://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', process.env.NEO4J_PASSWORD ?? 'neo4j'),
  );
  const session = driver.session();

  try {
    console.log('Resetting Neo4j graph...');
    await session.run('MATCH (n) DETACH DELETE n');

    console.log('Creating Neo4j constraints...');
    const constraints = [
      'CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE',
      'CREATE CONSTRAINT crime_id IF NOT EXISTS FOR (c:Crime) REQUIRE c.id IS UNIQUE',
      'CREATE CONSTRAINT vehicle_id IF NOT EXISTS FOR (v:Vehicle) REQUIRE v.id IS UNIQUE',
      'CREATE CONSTRAINT weapon_id IF NOT EXISTS FOR (w:Weapon) REQUIRE w.id IS UNIQUE',
      'CREATE CONSTRAINT station_id IF NOT EXISTS FOR (s:PoliceStation) REQUIRE s.id IS UNIQUE',
      'CREATE CONSTRAINT phone_number IF NOT EXISTS FOR (ph:PhoneNumber) REQUIRE ph.number IS UNIQUE',
      'CREATE CONSTRAINT address_value IF NOT EXISTS FOR (a:Address) REQUIRE a.value IS UNIQUE',
    ];
    for (const c of constraints) await session.run(c);

    console.log('Loading Police Stations...');
    for (const batch of batches(data.stations)) {
      await session.run(
        `UNWIND $rows AS row
         MERGE (s:PoliceStation {id: row.id})
         SET s.name = row.name, s.code = row.code`,
        { rows: batch },
      );
    }

    console.log('Loading Persons...');
    for (const batch of batches(data.persons)) {
      await session.run(
        `UNWIND $rows AS row
         MERGE (p:Person {id: row.id})
         SET p.fullName = row.fullName, p.alias = row.alias, p.gender = row.gender`,
        { rows: batch },
      );
    }

    console.log('Loading Vehicles...');
    for (const batch of batches(data.vehicles)) {
      await session.run(
        `UNWIND $rows AS row
         MERGE (v:Vehicle {id: row.id})
         SET v.registrationNumber = row.registrationNumber, v.type = row.type`,
        { rows: batch },
      );
    }

    console.log('Loading Weapons...');
    for (const batch of batches(data.weapons)) {
      await session.run(
        `UNWIND $rows AS row
         MERGE (w:Weapon {id: row.id})
         SET w.type = row.type`,
        { rows: batch },
      );
    }

    console.log('Loading Crimes...');
    for (const batch of batches(data.crimes)) {
      await session.run(
        `UNWIND $rows AS row
         MERGE (c:Crime {id: row.id})
         SET c.status = row.status, c.occurredAt = row.occurredAt
         WITH c, row
         MATCH (s:PoliceStation {id: row.stationId})
         MERGE (c)-[:OCCURRED_AT]->(s)`,
        { rows: batch.map((c) => ({ ...c, occurredAt: c.occurredAt.toISOString() })) },
      );
    }

    console.log('Linking Persons <-> Crimes (INVOLVED_IN)...');
    for (const batch of batches(data.crimePersons)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (p:Person {id: row.personId})
         MATCH (c:Crime {id: row.crimeId})
         MERGE (p)-[r:INVOLVED_IN]->(c)
         SET r.role = row.role`,
        { rows: batch },
      );
    }

    console.log('Linking Crimes <-> Vehicles...');
    for (const batch of batches(data.crimeVehicles)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (c:Crime {id: row.crimeId})
         MATCH (v:Vehicle {id: row.vehicleId})
         MERGE (c)-[r:USED_VEHICLE]->(v)
         SET r.role = row.role`,
        { rows: batch },
      );
    }

    console.log('Linking Crimes <-> Weapons...');
    for (const batch of batches(data.crimeWeapons)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (c:Crime {id: row.crimeId})
         MATCH (w:Weapon {id: row.weaponId})
         MERGE (c)-[:USED_WEAPON]->(w)`,
        { rows: batch },
      );
    }

    console.log('Linking Person <-> owned Vehicles...');
    const ownerLinks = data.vehicles.filter((v) => v.ownerPersonId);
    for (const batch of batches(ownerLinks)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (p:Person {id: row.ownerPersonId})
         MATCH (v:Vehicle {id: row.id})
         MERGE (p)-[:OWNS_VEHICLE]->(v)`,
        { rows: batch },
      );
    }

    console.log('Linking Person <-> PhoneNumber / Address (shared nodes)...');
    const phoneLinks = data.persons
      .filter((p) => p.phoneNumber)
      .map((p) => ({ personId: p.id, number: p.phoneNumber }));
    for (const batch of batches(phoneLinks)) {
      await session.run(
        `UNWIND $rows AS row
         MERGE (ph:PhoneNumber {number: row.number})
         WITH ph, row
         MATCH (p:Person {id: row.personId})
         MERGE (p)-[:HAS_PHONE]->(ph)`,
        { rows: batch },
      );
    }

    const addressLinks = data.persons
      .filter((p) => p.addressLine)
      .map((p) => ({ personId: p.id, value: p.addressLine }));
    for (const batch of batches(addressLinks)) {
      await session.run(
        `UNWIND $rows AS row
         MERGE (a:Address {value: row.value})
         WITH a, row
         MATCH (p:Person {id: row.personId})
         MERGE (p)-[:HAS_ADDRESS]->(a)`,
        { rows: batch },
      );
    }

    console.log('Deriving CO_SUSPECT edges (co-offending pairs, for gang detection)...');
    const suspectsByCrime = new Map<string, string[]>();
    data.crimePersons
      .filter((cp) => cp.role === 'SUSPECT')
      .forEach((cp) => {
        const arr = suspectsByCrime.get(cp.crimeId) ?? [];
        arr.push(cp.personId);
        suspectsByCrime.set(cp.crimeId, arr);
      });

    const pairCounts = new Map<string, number>();
    for (const suspects of suspectsByCrime.values()) {
      for (let i = 0; i < suspects.length; i++) {
        for (let j = i + 1; j < suspects.length; j++) {
          const [a, b] = [suspects[i], suspects[j]].sort();
          const key = `${a}|${b}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const coSuspectRows = Array.from(pairCounts.entries()).map(([key, count]) => {
      const [a, b] = key.split('|');
      return { a, b, count };
    });
    for (const batch of batches(coSuspectRows)) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (p1:Person {id: row.a})
         MATCH (p2:Person {id: row.b})
         MERGE (p1)-[r:CO_SUSPECT]-(p2)
         SET r.sharedCrimeCount = row.count`,
        { rows: batch },
      );
    }
    console.log(`  ${coSuspectRows.length} CO_SUSPECT pairs derived.`);

    console.log('Neo4j seed complete.');
  } finally {
    await session.close();
    await driver.close();
  }
}
