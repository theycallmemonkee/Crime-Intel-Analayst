import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStationDto } from './dto/create-station.dto';

@Injectable()
export class StationsService {
  constructor(private prisma: PrismaService) {}

  findAll(districtId?: string) {
    return this.prisma.policeStation.findMany({
      where: districtId ? { districtId } : undefined,
      include: { district: true },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.policeStation.findUnique({
      where: { id },
      include: { district: true },
    });
  }

  create(dto: CreateStationDto) {
    return this.prisma.policeStation.create({ data: dto });
  }
}
