import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/jurisdiction.util';
import { GeospatialService } from './geospatial.service';
import { QueryGeospatialDto } from './dto/query-geospatial.dto';

@Controller('geospatial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GeospatialController {
  constructor(private geospatialService: GeospatialService) {}

  @Get('points')
  points(@CurrentUser() user: RequestUser, @Query() query: QueryGeospatialDto) {
    return this.geospatialService.points(user, query);
  }

  @Get('hotspots')
  hotspots(
    @CurrentUser() user: RequestUser,
    @Query() query: QueryGeospatialDto,
    @Query('epsKm') epsKm?: string,
    @Query('minPoints') minPoints?: string,
  ) {
    return this.geospatialService.hotspots(user, query, epsKm ? Number(epsKm) : 5, minPoints ? Number(minPoints) : 3);
  }
}
