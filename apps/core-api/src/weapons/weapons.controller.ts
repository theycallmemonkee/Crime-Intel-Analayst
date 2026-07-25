import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { WeaponsService } from './weapons.service';
import { CreateWeaponDto } from './dto/create-weapon.dto';

@Controller('weapons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeaponsController {
  constructor(private weaponsService: WeaponsService) {}

  @Get()
  findAll() {
    return this.weaponsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.weaponsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OFFICER)
  create(@Body() dto: CreateWeaponDto) {
    return this.weaponsService.create(dto);
  }
}
