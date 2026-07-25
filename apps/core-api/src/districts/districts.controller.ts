import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { DistrictsService } from './districts.service';
import { CreateDistrictDto } from './dto/create-district.dto';

@Controller('districts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DistrictsController {
  constructor(private districtsService: DistrictsService) {}

  @Get()
  findAll() {
    return this.districtsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.districtsService.findOne(id);
  }

  // Reference/master data — only Admin manages the list of districts.
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateDistrictDto) {
    return this.districtsService.create(dto);
  }
}
