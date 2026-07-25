import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { StationsService } from './stations.service';
import { CreateStationDto } from './dto/create-station.dto';

@Controller('stations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StationsController {
  constructor(private stationsService: StationsService) {}

  @Get()
  findAll(@Query('districtId') districtId?: string) {
    return this.stationsService.findAll(districtId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stationsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateStationDto) {
    return this.stationsService.create(dto);
  }
}
