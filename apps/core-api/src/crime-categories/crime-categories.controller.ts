import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CrimeCategoriesService } from './crime-categories.service';
import { CreateCrimeCategoryDto } from './dto/create-crime-category.dto';

@Controller('crime-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrimeCategoriesController {
  constructor(private crimeCategoriesService: CrimeCategoriesService) {}

  @Get()
  findAll() {
    return this.crimeCategoriesService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCrimeCategoryDto) {
    return this.crimeCategoriesService.create(dto.name, dto.severityWeight);
  }
}
