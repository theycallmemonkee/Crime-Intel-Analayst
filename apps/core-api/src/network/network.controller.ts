import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { NetworkService } from './network.service';

// Network & Link Analysis is an Analyst/Admin capability, not an Officer
// one — matching the Milestone 1 role table verbatim ("SCRB Analyst:
// Network analysis... state-wide"). Officers work their own station's
// cases; state-wide cross-case link analysis is a different job function.
@Controller('network')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.ANALYST)
export class NetworkController {
  constructor(private networkService: NetworkService) {}

  @Get('repeat-offenders')
  repeatOffenders(@Query('minCrimes') minCrimes?: string, @Query('limit') limit?: string) {
    return this.networkService.repeatOffenders(minCrimes ? Number(minCrimes) : 3, limit ? Number(limit) : 20);
  }

  @Get('hidden-associations')
  hiddenAssociations(@Query('limit') limit?: string) {
    return this.networkService.hiddenAssociations(limit ? Number(limit) : 30);
  }

  @Get('gangs')
  gangs(@Query('minSize') minSize?: string) {
    return this.networkService.gangs(minSize ? Number(minSize) : 3);
  }

  @Get('person/:id/graph')
  personGraph(@Param('id') id: string, @Query('crimeLimit') crimeLimit?: string) {
    return this.networkService.personEgoGraph(id, crimeLimit ? Number(crimeLimit) : 8);
  }
}
