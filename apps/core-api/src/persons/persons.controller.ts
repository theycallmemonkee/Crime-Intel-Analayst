import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@Controller('persons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PersonsController {
  constructor(private personsService: PersonsService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.personsService.findAll(page ? Number(page) : undefined, pageSize ? Number(pageSize) : undefined);
  }

  // Not RESTfully a sub-collection, but kept as its own route (rather than a
  // `?q=` param on GET /persons) since it runs a materially different query
  // (pg_trgm similarity) with its own semantics.
  @Get('search')
  search(@Query('q') q: string) {
    return this.personsService.search(q ?? '');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personsService.findOne(id);
  }

  // Analysts are read-only on case data (no PII edit) — see Milestone 1 role table.
  @Post()
  @Roles(Role.ADMIN, Role.OFFICER)
  create(@Body() dto: CreatePersonDto) {
    return this.personsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OFFICER)
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.personsService.update(id, dto);
  }
}
