import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import neo4j from 'neo4j-driver';
import { Neo4jService } from '../neo4j/neo4j.service';
import { PrismaService } from '../prisma/prisma.service';

const GDS_PROCEDURE_NOT_FOUND = 'Neo.ClientError.Procedure.ProcedureNotFound';

// Cypher's LIMIT (and similar integer-typed positions) rejects a Float —
// and the driver sends plain JS numbers as Float by default. Every
// int-typed parameter in this file goes through this wrapper rather than
// being passed as a bare number.
const int = (n: number) => neo4j.int(n);

const GDS_GRAPH_NAME = 'coSuspectGraph';

export interface GraphNode {
  id: string;
  label: string;
  type: 'PERSON' | 'CRIME' | 'VEHICLE' | 'WEAPON' | 'PHONE' | 'ADDRESS';
}
export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

@Injectable()
export class NetworkService {
  private readonly logger = new Logger(NetworkService.name);

  constructor(
    private neo4j: Neo4jService,
    private prisma: PrismaService,
  ) {}

  // --- Repeat Offender Detection ---------------------------------------
  // A person is a "repeat offender" if they've been SUSPECT on 3+ distinct
  // crimes. The graph gives us who and how many; Postgres gives us the case
  // details worth showing an investigator (FIR number, category, station) —
  // this is the Milestone 1 architecture's Postgres/Neo4j split working as
  // designed: identity+relationships in the graph, record detail in the RDBMS.
  async repeatOffenders(minCrimes: number, limit: number) {
    const result = await this.neo4j.run(
      `MATCH (p:Person)-[:INVOLVED_IN {role: 'SUSPECT'}]->(c:Crime)
       WITH p, collect(DISTINCT c.id) AS crimeIds, count(DISTINCT c) AS crimeCount
       WHERE crimeCount >= $minCrimes
       RETURN p.id AS personId, p.fullName AS fullName, crimeCount, crimeIds
       ORDER BY crimeCount DESC
       LIMIT $limit`,
      { minCrimes: int(minCrimes), limit: int(limit) },
    );

    const rows = result.records.map((r) => ({
      personId: r.get('personId') as string,
      fullName: r.get('fullName') as string,
      crimeCount: r.get('crimeCount') as number,
      crimeIds: r.get('crimeIds') as string[],
    }));

    const allCrimeIds = Array.from(new Set(rows.flatMap((r) => r.crimeIds)));
    const crimes = await this.prisma.crime.findMany({
      where: { id: { in: allCrimeIds } },
      select: {
        id: true,
        occurredAt: true,
        status: true,
        category: { select: { name: true } },
        station: { select: { name: true } },
        fir: { select: { firNumber: true } },
      },
    });
    const crimeById = new Map(crimes.map((c) => [c.id, c]));

    return rows.map((r) => ({
      personId: r.personId,
      fullName: r.fullName,
      crimeCount: r.crimeCount,
      crimes: r.crimeIds
        .map((id) => crimeById.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((c) => ({
          id: c.id,
          firNumber: c.fir?.firNumber ?? null,
          category: c.category.name,
          station: c.station.name,
          occurredAt: c.occurredAt,
          status: c.status,
        })),
    }));
  }

  // --- Hidden Associations ------------------------------------------------
  // Pairs of people connected through a shared phone/address/vehicle who have
  // never appeared together as suspects on the same crime — i.e. links that
  // wouldn't surface from crime records alone. `via` says which shared
  // attribute is carrying the link.
  async hiddenAssociations(limit: number) {
    const perTypeLimit = Math.ceil(limit / 3);

    const [addressRows, phoneRows, vehicleRows] = await Promise.all([
      this.neo4j.run(
        `MATCH (p1:Person)-[:HAS_ADDRESS]->(a:Address)<-[:HAS_ADDRESS]-(p2:Person)
         WHERE p1.id < p2.id
           AND NOT EXISTS { MATCH (p1)-[:INVOLVED_IN]->(:Crime)<-[:INVOLVED_IN]-(p2) }
         RETURN p1.id AS person1Id, p1.fullName AS person1Name,
                p2.id AS person2Id, p2.fullName AS person2Name,
                a.value AS sharedValue
         LIMIT $limit`,
        { limit: int(perTypeLimit) },
      ),
      this.neo4j.run(
        `MATCH (p1:Person)-[:HAS_PHONE]->(ph:PhoneNumber)<-[:HAS_PHONE]-(p2:Person)
         WHERE p1.id < p2.id
           AND NOT EXISTS { MATCH (p1)-[:INVOLVED_IN]->(:Crime)<-[:INVOLVED_IN]-(p2) }
         RETURN p1.id AS person1Id, p1.fullName AS person1Name,
                p2.id AS person2Id, p2.fullName AS person2Name,
                ph.number AS sharedValue
         LIMIT $limit`,
        { limit: int(perTypeLimit) },
      ),
      this.neo4j.run(
        `MATCH (p1:Person)-[:INVOLVED_IN]->(c1:Crime)-[:USED_VEHICLE]->(v:Vehicle)<-[:USED_VEHICLE]-(c2:Crime)<-[:INVOLVED_IN]-(p2:Person)
         WHERE p1.id < p2.id AND c1 <> c2
           AND NOT EXISTS { MATCH (p1)-[:INVOLVED_IN]->(:Crime)<-[:INVOLVED_IN]-(p2) }
         RETURN DISTINCT p1.id AS person1Id, p1.fullName AS person1Name,
                p2.id AS person2Id, p2.fullName AS person2Name,
                v.registrationNumber AS sharedValue
         LIMIT $limit`,
        { limit: int(perTypeLimit) },
      ),
    ]);

    const toRows = (result: typeof addressRows, via: 'ADDRESS' | 'PHONE' | 'VEHICLE') =>
      result.records.map((r) => ({
        person1: { id: r.get('person1Id') as string, fullName: r.get('person1Name') as string },
        person2: { id: r.get('person2Id') as string, fullName: r.get('person2Name') as string },
        via,
        sharedValue: r.get('sharedValue') as string,
      }));

    return [
      ...toRows(addressRows, 'ADDRESS'),
      ...toRows(phoneRows, 'PHONE'),
      ...toRows(vehicleRows, 'VEHICLE'),
    ];
  }

  // --- Gang / Criminal Organization Discovery ------------------------------
  // Louvain community detection over the CO_SUSPECT graph (materialized at
  // seed time — see seed-neo4j.ts) via Neo4j GDS. A detected community of
  // 3+ co-offending people IS a gang/criminal-organization in graph terms —
  // deliberately not building "gang detection" and "criminal org discovery"
  // as two separate features, since under the hood they're the same
  // algorithm over the same graph (see Milestone 6 docs).
  async gangs(minSize: number) {
    try {
      return await this.gangsViaGds(minSize);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== GDS_PROCEDURE_NOT_FOUND) throw err;
      this.logger.warn(
        `GDS procedure unavailable (${(err as Error).message}) — falling back to a pure-Cypher ` +
          `connected-components implementation for gang detection.`,
      );
      return this.gangsViaConnectedComponents(minSize);
    }
  }

  private async gangsViaGds(minSize: number) {
    // Best-effort cleanup in case a previous call left the projection behind
    // (e.g. the process crashed mid-request) — GDS refuses to re-project a
    // name that already exists.
    await this.neo4j.run(`CALL gds.graph.drop('${GDS_GRAPH_NAME}', false) YIELD graphName RETURN graphName`);

    await this.neo4j.run(
      `CALL gds.graph.project(
         $graphName, 'Person',
         {CO_SUSPECT: {orientation: 'UNDIRECTED', properties: 'sharedCrimeCount'}}
       ) YIELD graphName`,
      { graphName: GDS_GRAPH_NAME },
    );

    let communities;
    try {
      communities = await this.neo4j.run(
        `CALL gds.louvain.stream($graphName, {relationshipWeightProperty: 'sharedCrimeCount'})
         YIELD nodeId, communityId
         WITH communityId, gds.util.asNode(nodeId) AS person
         WITH communityId, collect({id: person.id, fullName: person.fullName}) AS members
         WHERE size(members) >= $minSize
         RETURN communityId, members
         ORDER BY size(members) DESC`,
        { graphName: GDS_GRAPH_NAME, minSize: int(minSize) },
      );
    } finally {
      await this.neo4j.run(`CALL gds.graph.drop('${GDS_GRAPH_NAME}', false) YIELD graphName RETURN graphName`);
    }

    const groups = communities.records.map((r) => ({
      communityId: r.get('communityId') as number,
      members: r.get('members') as { id: string; fullName: string }[],
    }));

    return this.attachIntraGroupEdges(groups);
  }

  // GDS-free substitute for gangs() when the GDS plugin isn't installed —
  // connected components (union-find) over the same CO_SUSPECT graph,
  // computed in application code from one plain Cypher MATCH. This is a
  // genuinely different, simpler algorithm from Louvain (no modularity
  // optimization — Louvain can split one connected component into several
  // tighter-knit communities; this returns whole components), not an
  // approximation of it. Still a correct answer to "who's transitively
  // linked by shared-crime co-suspicion", just less granular.
  private async gangsViaConnectedComponents(minSize: number) {
    const edgeResult = await this.neo4j.run(
      `MATCH (p1:Person)-[r:CO_SUSPECT]-(p2:Person)
       WHERE p1.id < p2.id
       RETURN p1.id AS source, p1.fullName AS sourceName,
              p2.id AS target, p2.fullName AS targetName,
              r.sharedCrimeCount AS weight`,
    );

    const edges = edgeResult.records.map((r) => ({
      source: r.get('source') as string,
      sourceName: r.get('sourceName') as string,
      target: r.get('target') as string,
      targetName: r.get('targetName') as string,
      weight: r.get('weight') as number,
    }));

    const parent = new Map<string, string>();
    const names = new Map<string, string>();
    const find = (x: string): string => {
      while (parent.get(x) !== x) {
        const p = parent.get(x) as string;
        parent.set(x, parent.get(p) as string);
        x = p;
      }
      return x;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    const ensure = (id: string, name: string) => {
      if (!parent.has(id)) {
        parent.set(id, id);
        names.set(id, name);
      }
    };

    edges.forEach((e) => {
      ensure(e.source, e.sourceName);
      ensure(e.target, e.targetName);
      union(e.source, e.target);
    });

    const componentMembers = new Map<string, { id: string; fullName: string }[]>();
    for (const id of parent.keys()) {
      const root = find(id);
      const arr = componentMembers.get(root) ?? [];
      arr.push({ id, fullName: names.get(id) as string });
      componentMembers.set(root, arr);
    }

    const groups = Array.from(componentMembers.values())
      .map((members, i) => ({ communityId: i, members }))
      .filter((g) => g.members.length >= minSize)
      .sort((a, b) => b.members.length - a.members.length);

    return groups.map((g) => {
      const memberIds = new Set(g.members.map((m) => m.id));
      return {
        communityId: g.communityId,
        size: g.members.length,
        members: g.members,
        edges: edges
          .filter((e) => memberIds.has(e.source) && memberIds.has(e.target))
          .map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
      };
    });
  }

  // Pulls the CO_SUSPECT edges among each group's own members, so the
  // frontend can render an actual node-link diagram, not just a member list.
  private async attachIntraGroupEdges(groups: { communityId: number; members: { id: string; fullName: string }[] }[]) {
    return Promise.all(
      groups.map(async (g) => {
        const memberIds = g.members.map((m) => m.id);
        const edgeResult = await this.neo4j.run(
          `MATCH (p1:Person)-[r:CO_SUSPECT]-(p2:Person)
           WHERE p1.id IN $memberIds AND p2.id IN $memberIds AND p1.id < p2.id
           RETURN p1.id AS source, p2.id AS target, r.sharedCrimeCount AS weight`,
          { memberIds },
        );
        return {
          communityId: g.communityId,
          size: g.members.length,
          members: g.members,
          edges: edgeResult.records.map((r) => ({
            source: r.get('source') as string,
            target: r.get('target') as string,
            weight: r.get('weight') as number,
          })),
        };
      }),
    );
  }

  // --- Person ego-graph (link chart) ---------------------------------------
  // A bounded 1-hop neighborhood around one person: crimes they're linked to
  // (capped, most recent first), co-participants on those crimes, and
  // shared-attribute connections (phone/address). Bounded because an
  // unbounded ego network for an 18-crime repeat offender would be an
  // unreadable hairball, not a useful investigative visualization.
  async personEgoGraph(personId: string, crimeLimit = 8): Promise<Graph> {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const personResult = await this.neo4j.run(`MATCH (p:Person {id: $personId}) RETURN p.fullName AS fullName`, {
      personId,
    });
    if (personResult.records.length === 0) throw new NotFoundException(`Person ${personId} not found`);
    nodes.set(personId, { id: personId, label: personResult.records[0].get('fullName'), type: 'PERSON' });

    const crimeResult = await this.neo4j.run(
      `MATCH (p:Person {id: $personId})-[r:INVOLVED_IN]->(c:Crime)
       RETURN c.id AS crimeId, c.status AS status, c.occurredAt AS occurredAt, r.role AS role
       ORDER BY c.occurredAt DESC
       LIMIT $crimeLimit`,
      { personId, crimeLimit: int(crimeLimit) },
    );
    const crimeIds = crimeResult.records.map((r) => r.get('crimeId') as string);
    crimeResult.records.forEach((r) => {
      const crimeId = r.get('crimeId') as string;
      nodes.set(crimeId, { id: crimeId, label: `Crime (${r.get('status')})`, type: 'CRIME' });
      edges.push({ source: personId, target: crimeId, label: r.get('role') as string });
    });

    if (crimeIds.length > 0) {
      const coParticipants = await this.neo4j.run(
        `MATCH (c:Crime)<-[r:INVOLVED_IN]-(other:Person)
         WHERE c.id IN $crimeIds AND other.id <> $personId
         RETURN DISTINCT c.id AS crimeId, other.id AS otherId, other.fullName AS otherName, r.role AS role
         LIMIT 40`,
        { crimeIds, personId },
      );
      coParticipants.records.forEach((r) => {
        const otherId = r.get('otherId') as string;
        nodes.set(otherId, { id: otherId, label: r.get('otherName') as string, type: 'PERSON' });
        edges.push({ source: r.get('crimeId') as string, target: otherId, label: r.get('role') as string });
      });

      const vehicles = await this.neo4j.run(
        `MATCH (c:Crime)-[r:USED_VEHICLE]->(v:Vehicle)
         WHERE c.id IN $crimeIds
         RETURN DISTINCT c.id AS crimeId, v.id AS vehicleId, v.registrationNumber AS reg, r.role AS role
         LIMIT 20`,
        { crimeIds },
      );
      vehicles.records.forEach((r) => {
        const vehicleId = r.get('vehicleId') as string;
        nodes.set(vehicleId, { id: vehicleId, label: r.get('reg') as string, type: 'VEHICLE' });
        edges.push({ source: r.get('crimeId') as string, target: vehicleId, label: r.get('role') as string });
      });

      const weapons = await this.neo4j.run(
        `MATCH (c:Crime)-[:USED_WEAPON]->(w:Weapon)
         WHERE c.id IN $crimeIds
         RETURN DISTINCT c.id AS crimeId, w.id AS weaponId, w.type AS type
         LIMIT 20`,
        { crimeIds },
      );
      weapons.records.forEach((r) => {
        const weaponId = r.get('weaponId') as string;
        nodes.set(weaponId, { id: weaponId, label: r.get('type') as string, type: 'WEAPON' });
        edges.push({ source: r.get('crimeId') as string, target: weaponId, label: 'USED_WEAPON' });
      });
    }

    const sharedAttrs = await this.neo4j.run(
      `MATCH (p:Person {id: $personId})-[:HAS_PHONE]->(ph:PhoneNumber)<-[:HAS_PHONE]-(other:Person)
       WHERE other.id <> $personId
       RETURN 'PHONE' AS kind, ph.number AS value, other.id AS otherId, other.fullName AS otherName
       LIMIT 10
       UNION
       MATCH (p:Person {id: $personId})-[:HAS_ADDRESS]->(a:Address)<-[:HAS_ADDRESS]-(other:Person)
       WHERE other.id <> $personId
       RETURN 'ADDRESS' AS kind, a.value AS value, other.id AS otherId, other.fullName AS otherName
       LIMIT 10`,
      { personId },
    );
    sharedAttrs.records.forEach((r) => {
      const kind = r.get('kind') as 'PHONE' | 'ADDRESS';
      const value = r.get('value') as string;
      const attrNodeId = `${kind}:${value}`;
      const otherId = r.get('otherId') as string;
      nodes.set(attrNodeId, { id: attrNodeId, label: value, type: kind === 'PHONE' ? 'PHONE' : 'ADDRESS' });
      nodes.set(otherId, { id: otherId, label: r.get('otherName') as string, type: 'PERSON' });
      edges.push({ source: personId, target: attrNodeId, label: `HAS_${kind}` });
      edges.push({ source: otherId, target: attrNodeId, label: `HAS_${kind}` });
    });

    return { nodes: Array.from(nodes.values()), edges };
  }
}
