import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrimeCategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.crimeCategory.findMany({ orderBy: { name: 'asc' } });
  }

  create(name: string, severityWeight?: number) {
    return this.prisma.crimeCategory.create({ data: { name, severityWeight } });
  }
}
