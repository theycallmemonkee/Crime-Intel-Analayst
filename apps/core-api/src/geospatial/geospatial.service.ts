import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { districtScopeFilter, RequestUser } from '../common/jurisdiction.util';
import { buildCrimeScopeConditions, crimeWhereClause } from '../common/sql-scope.util';
import { QueryGeospatialDto } from './dto/query-geospatial.dto';

// 1 degree of latitude/longitude ≈ 111.32km at the equator. PostGIS's
// ST_ClusterDBSCAN operates in the units of the geometry's SRID (degrees,
// for our SRID 4326 columns) — there's no built-in geography variant, so
// this is the standard approximation for converting a human "radius in km"
// input into degrees for regional-scale clustering. It's accurate enough at
// Karnataka's latitude for a prototype hotspot view; it is not survey-grade.
const KM_PER_DEGREE = 111.32;

interface HotspotRow {
  cluster_id: number;
  point_count: bigint;
  lat: number;
  lng: number;
}

@Injectable()
export class GeospatialService {
  constructor(private prisma: PrismaService) {}

  async points(user: RequestUser, query: QueryGeospatialDto) {
    const where: Prisma.CrimeWhereInput = {
      ...districtScopeFilter(user),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.stationId ? { stationId: query.stationId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const crimes = await this.prisma.crime.findMany({
      where,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        occurredAt: true,
        status: true,
        category: { select: { name: true } },
        station: { select: { name: true } },
      },
    });

    return crimes.map((c) => ({
      id: c.id,
      latitude: c.latitude,
      longitude: c.longitude,
      category: c.category.name,
      status: c.status,
      station: c.station.name,
      occurredAt: c.occurredAt,
    }));
  }

  // Real DBSCAN clustering via PostGIS (ST_ClusterDBSCAN), not just visual
  // marker-bundling — this is what makes "Crime Hotspots" an actual GIS
  // technique rather than a UI trick. `from`/`to` on the same query is what
  // implements "Time-based Crime Clusters": the same algorithm, scoped to a
  // window, so hotspots can be compared across time periods.
  async hotspots(user: RequestUser, query: QueryGeospatialDto, epsKm: number, minPoints: number) {
    const conditions = buildCrimeScopeConditions(user, query);
    if (query.from) conditions.push(Prisma.sql`"occurredAt" >= ${new Date(query.from)}`);
    if (query.to) conditions.push(Prisma.sql`"occurredAt" <= ${new Date(query.to)}`);
    const where = crimeWhereClause(conditions);
    const epsDegrees = epsKm / KM_PER_DEGREE;

    const rows = await this.prisma.$queryRaw<HotspotRow[]>`
      WITH clustered AS (
        SELECT id, geom,
               ST_ClusterDBSCAN(geom, ${epsDegrees}::float8, ${minPoints}::int) OVER () AS cluster_id
        FROM "Crime"
        ${where}
      )
      SELECT cluster_id,
             COUNT(*) AS point_count,
             ST_Y(ST_Centroid(ST_Collect(geom))) AS lat,
             ST_X(ST_Centroid(ST_Collect(geom))) AS lng
      FROM clustered
      WHERE cluster_id IS NOT NULL
      GROUP BY cluster_id
      ORDER BY point_count DESC
    `;

    return rows.map((r) => ({
      clusterId: r.cluster_id,
      pointCount: Number(r.point_count),
      latitude: r.lat,
      longitude: r.lng,
    }));
  }
}
