import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/jurisdiction.util';
import { ReportsService } from './reports.service';
import { QueryCrimeTrendReportDto } from './dto/query-crime-trend-report.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // Admin/Analyst only — embeds Network & AI Intelligence findings, which
  // are themselves Admin/Analyst-only capabilities (Milestones 6/7).
  @Get('intelligence')
  @Roles(Role.ADMIN, Role.ANALYST)
  intelligenceReport(@CurrentUser() user: RequestUser) {
    return this.reportsService.intelligenceReport(user);
  }

  @Get('crime-trends')
  crimeTrendReport(@CurrentUser() user: RequestUser, @Query() query: QueryCrimeTrendReportDto) {
    return this.reportsService.crimeTrendReport(user, query);
  }

  @Get('district/:districtId')
  districtReport(@CurrentUser() user: RequestUser, @Param('districtId') districtId: string) {
    return this.reportsService.districtReport(user, districtId);
  }

  @Get('investigation/:crimeId')
  investigationReport(@CurrentUser() user: RequestUser, @Param('crimeId') crimeId: string) {
    return this.reportsService.investigationReport(user, crimeId);
  }
}
