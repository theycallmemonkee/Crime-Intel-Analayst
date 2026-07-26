import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import neo4j, { Driver, Session } from 'neo4j-driver';

// Thin wrapper around the official Neo4j driver — deliberately not an OGM.
// The graph model here is small enough (a handful of node/relationship types)
// that hand-written, parameterized Cypher is easier to reason about than an
// abstraction layer on top of it.
@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private driver!: Driver;
  private readonly logger = new Logger(Neo4jService.name);

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
    } catch (err) {
      // Every Neo4j failure gets logged with the exact query, params, and
      // driver error — the generic "Internal server error" a client sees
      // (NestJS flattens any uncaught error to that) is useless for
      // debugging on its own; this is what actually explains a failure.
      const neo4jErr = err as { code?: string; message?: string };
      this.logger.error(
        `Neo4j query failed [${neo4jErr.code ?? 'unknown'}]: ${neo4jErr.message ?? err}\n` +
          `Cypher: ${cypher}\nParams: ${JSON.stringify(params)}`,
      );

      // ServiceUnavailable specifically means "couldn't reach the database
      // at all" (wrong host/port, database down) — a dependency outage, not
      // a bug in this request. That's a 503, distinct from every other
      // Neo4j error (bad Cypher, missing procedure, etc.), which are real
      // bugs and should keep surfacing as 500s so they get noticed and fixed
      // rather than silently downgraded to "service unavailable".
      if (neo4jErr.code === neo4j.error.SERVICE_UNAVAILABLE) {
        throw new ServiceUnavailableException(
          'The graph database is temporarily unavailable. Network & Link Analysis requires it — other features are unaffected.',
        );
      }
      throw err;
    } finally {
      await session.close();
    }
  }
}
