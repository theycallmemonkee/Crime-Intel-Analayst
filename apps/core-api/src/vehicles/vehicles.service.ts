import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

interface VehicleSearchRow {
  id: string;
  registrationNumber: string;
  type: string;
  color: string | null;
  similarity: number;
}

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  findAll(page = 1, pageSize = 25) {
    return this.prisma.vehicle.findMany({
      orderBy: { registrationNumber: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async search(query: string, limit = 20): Promise<VehicleSearchRow[]> {
    return this.prisma.$queryRaw<VehicleSearchRow[]>`
      SELECT id, "registrationNumber", type, color,
             similarity("registrationNumber", ${query}) AS similarity
      FROM "Vehicle"
      WHERE "registrationNumber" % ${query} OR "registrationNumber" ILIKE '%' || ${query} || '%'
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
  }

  findOne(id: string) {
    return this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        ownerPerson: true,
        crimeLinks: { include: { crime: { include: { category: true, station: true, fir: true } } } },
      },
    });
  }

  create(dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: dto });
  }

  update(id: string, dto: UpdateVehicleDto) {
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }
}
