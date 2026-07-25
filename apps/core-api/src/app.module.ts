import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { Neo4jModule } from './neo4j/neo4j.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DistrictsModule } from './districts/districts.module';
import { StationsModule } from './stations/stations.module';
import { CrimeCategoriesModule } from './crime-categories/crime-categories.module';
import { PersonsModule } from './persons/persons.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { WeaponsModule } from './weapons/weapons.module';
import { CrimesModule } from './crimes/crimes.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { GeospatialModule } from './geospatial/geospatial.module';
import { NetworkModule } from './network/network.module';
import { AiModule } from './ai/ai.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    Neo4jModule,
    AuthModule,
    UsersModule,
    DistrictsModule,
    StationsModule,
    CrimeCategoriesModule,
    PersonsModule,
    VehiclesModule,
    WeaponsModule,
    CrimesModule,
    DashboardsModule,
    GeospatialModule,
    NetworkModule,
    AiModule,
    ReportsModule,
  ],
})
export class AppModule {}
