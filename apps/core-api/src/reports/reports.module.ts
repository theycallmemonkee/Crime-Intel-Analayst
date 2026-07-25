import { Module } from '@nestjs/common';
import { DashboardsModule } from '../dashboards/dashboards.module';
import { NetworkModule } from '../network/network.module';
import { AiModule } from '../ai/ai.module';
import { CrimesModule } from '../crimes/crimes.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [DashboardsModule, NetworkModule, AiModule, CrimesModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
