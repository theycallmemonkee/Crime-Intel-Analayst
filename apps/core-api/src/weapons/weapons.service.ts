import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeaponDto } from './dto/create-weapon.dto';

@Injectable()
export class WeaponsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.weapon.findMany({ orderBy: { type: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.weapon.findUnique({
      where: { id },
      include: { crimeLinks: { include: { crime: true } } },
    });
  }

  create(dto: CreateWeaponDto) {
    return this.prisma.weapon.create({ data: dto });
  }
}
