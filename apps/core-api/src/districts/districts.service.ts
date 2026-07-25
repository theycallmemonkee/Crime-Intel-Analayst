import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDistrictDto } from './dto/create-district.dto';

@Injectable()
export class DistrictsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.district.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.district.findUnique({
      where: { id },
      include: { stations: true },
    });
  }

  create(dto: CreateDistrictDto) {
    return this.prisma.district.create({ data: dto });
  }
}
