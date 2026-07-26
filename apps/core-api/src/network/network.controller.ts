import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { NetworkService } from './network.service';

// Deliberately not `ParseIntPipe({ optional: true })`: the app's global
// ValidationPipe (main.ts, transform: true) runs *before* per-param pipes
// and, for any parameter whose reflected type is `number`, unconditionally
// does `+value` — turning an absent (`undefined`) query param into `NaN`
// before ParseIntPipe ever sees it, so its `optional` handling never
// triggers. Keeping these params typed as `string | undefined` sidesteps
// that entirely (the global pipe's `String` handling correctly leaves
// `undefined` alone) and this parses explicitly instead.
function parseOptionalInt(value: string | undefined, paramName: string): number | undefined {
  if (value === undefined) return undefined;
  if (!/^-?\d+$/.test(value)) {
    throw new BadRequestException(`Query parameter "${paramName}" must be an integer, got "${value}"`);
  }
  return parseInt(value, 10);
}

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
    return this.networkService.repeatOffenders(
      parseOptionalInt(minCrimes, 'minCrimes') ?? 3,
      parseOptionalInt(limit, 'limit') ?? 20,
    );
  }

  @Get('hidden-associations')
  hiddenAssociations(@Query('limit') limit?: string) {
    return this.networkService.hiddenAssociations(parseOptionalInt(limit, 'limit') ?? 30);
  }

  @Get('gangs')
  gangs(@Query('minSize') minSize?: string) {
    return this.networkService.gangs(parseOptionalInt(minSize, 'minSize') ?? 3);
  }

  @Get('person/:id/graph')
  personGraph(@Param('id') id: string, @Query('crimeLimit') crimeLimit?: string) {
    return this.networkService.personEgoGraph(id, parseOptionalInt(crimeLimit, 'crimeLimit') ?? 8);
  }
}
