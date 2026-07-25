import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';

// Thin wrapper around the official Neo4j driver — deliberately not an OGM.
// The graph model here is small enough (a handful of node/relationship types)
// that hand-written, parameterized Cypher is easier to reason about than an
// abstraction layer on top of it.
@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private driver!: Driver;

  onModuleInit() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI ?? 'bolt://localhost:7687',
      neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', process.env.NEO4J_PASSWORD ?? 'neo4j'),
      // Cypher integers (COUNT, community IDs, etc.) otherwise come back as
      // lossless Integer objects instead of plain JS numbers. Every value
      // this app deals with (counts, community IDs) is well within safe
      // integer range, so the precision the wrapper protects against never
      // applies here — plain numbers are worth the convenience.
      { disableLosslessIntegers: true },
    );
  }

  async onModuleDestroy() {
    await this.driver?.close();
  }

  getSession(): Session {
    return this.driver.session();
  }

  async run(cypher: string, params: Record<string, unknown> = {}) {
    const session = this.getSession();
    try {
      return await session.run(cypher, params);
    } finally {
      await session.close();
    }
  }
}
