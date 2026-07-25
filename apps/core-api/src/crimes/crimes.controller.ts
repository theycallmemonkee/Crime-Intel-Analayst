import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/jurisdiction.util';
import { CrimesService } from './crimes.service';
import { CreateCrimeDto } from './dto/create-crime.dto';
import { QueryCrimesDto } from './dto/query-crimes.dto';
import { UpdateCrimeStatusDto } from './dto/update-crime-status.dto';
import { LinkPersonDto } from './dto/link-person.dto';
import { LinkVehicleDto } from './dto/link-vehicle.dto';
import { LinkWeaponDto } from './dto/link-weapon.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Controller('crimes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrimesController {
  constructor(private crimesService: CrimesService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() query: QueryCrimesDto) {
    return this.crimesService.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.crimesService.findOne(user, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OFFICER)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCrimeDto) {
    return this.crimesService.create(user, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.OFFICER)
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCrimeStatusDto,
  ) {
    return this.crimesService.updateStatus(user, id, dto);
  }

  @Post(':id/persons')
  @Roles(Role.ADMIN, Role.OFFICER)
  linkPerson(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: LinkPersonDto) {
    return this.crimesService.linkPerson(user, id, dto);
  }

  @Delete(':id/persons/:linkId')
  @Roles(Role.ADMIN, Role.OFFICER)
  unlinkPerson(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ) {
    return this.crimesService.unlinkPerson(user, id, linkId);
  }

  @Post(':id/vehicles')
  @Roles(Role.ADMIN, Role.OFFICER)
  linkVehicle(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: LinkVehicleDto) {
    return this.crimesService.linkVehicle(user, id, dto);
  }

  @Post(':id/weapons')
  @Roles(Role.ADMIN, Role.OFFICER)
  linkWeapon(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: LinkWeaponDto) {
    return this.crimesService.linkWeapon(user, id, dto);
  }

  @Post(':id/evidence')
  @Roles(Role.ADMIN, Role.OFFICER)
  addEvidence(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: CreateEvidenceDto) {
    return this.crimesService.addEvidence(user, id, dto);
  }
}
