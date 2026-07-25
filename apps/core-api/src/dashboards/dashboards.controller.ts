import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/jurisdiction.util';
import { DashboardsService } from './dashboards.service';
import { QueryDashboardDto } from './dto/query-dashboard.dto';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardsController {
  constructor(private dashboardsService: DashboardsService) {}

  @Get('summary')
  summary(@CurrentUser() user: RequestUser, @Query() query: QueryDashboardDto) {
    return this.dashboardsService.summary(user, query);
  }

  @Get('by-category')
  byCategory(@CurrentUser() user: RequestUser, @Query() query: QueryDashboardDto) {
    return this.dashboardsService.byCategory(user, query);
  }

  @Get('by-district')
  byDistrict(@CurrentUser() user: RequestUser, @Query() query: QueryDashboardDto) {
    return this.dashboardsService.byDistrict(user, query);
  }

  @Get('by-station')
  byStation(@CurrentUser() user: RequestUser, @Query() query: QueryDashboardDto) {
    return this.dashboardsService.byStation(user, query);
  }

  @Get('by-status')
  byStatus(@CurrentUser() user: RequestUser, @Query() query: QueryDashboardDto) {
    return this.dashboardsService.byStatus(user, query);
  }

  @Get('trends/monthly')
  monthlyTrend(
    @CurrentUser() user: RequestUser,
    @Query() query: QueryDashboardDto,
    @Query('year') year?: string,
  ) {
    return this.dashboardsService.monthlyTrend(user, query, year ? Number(year) : new Date().getFullYear());
  }

  @Get('trends/yearly')
  yearlyTrend(@CurrentUser() user: RequestUser, @Query() query: QueryDashboardDto) {
    return this.dashboardsService.yearlyTrend(user, query);
  }
}
