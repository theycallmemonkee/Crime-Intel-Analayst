import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

interface PersonSearchRow {
  id: string;
  fullName: string;
  alias: string | null;
  gender: string;
  phoneNumber: string | null;
  addressLine: string | null;
  similarity: number;
}

@Injectable()
export class PersonsService {
  constructor(private prisma: PrismaService) {}

  findAll(page = 1, pageSize = 25) {
    return this.prisma.person.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  // Fuzzy name/address search via pg_trgm (see Milestone 1: chosen instead of
  // standing up Elasticsearch for the prototype) plus exact phone match —
  // this is what lets an investigator find "Ramesh Gowda" when they typed
  // "Ramesh Gowdaa", or find everyone sharing a phone number.
  async search(query: string, limit = 20): Promise<PersonSearchRow[]> {
    return this.prisma.$queryRaw<PersonSearchRow[]>`
      SELECT id, "fullName", alias, gender, "phoneNumber", "addressLine",
             GREATEST(similarity("fullName", ${query}), similarity(coalesce("addressLine", ''), ${query})) AS similarity
      FROM "Person"
      WHERE "fullName" % ${query}
         OR "addressLine" % ${query}
         OR "phoneNumber" = ${query}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
  }

  findOne(id: string) {
    return this.prisma.person.findUnique({
      where: { id },
      include: {
        crimeLinks: {
          include: {
            crime: { include: { category: true, station: true, district: true, fir: true } },
          },
        },
        ownedVehicles: true,
      },
    });
  }

  create(dto: CreatePersonDto) {
    const data: Prisma.PersonCreateInput = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };
    return this.prisma.person.create({ data });
  }

  update(id: string, dto: UpdatePersonDto) {
    const data: Prisma.PersonUpdateInput = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };
    return this.prisma.person.update({ where: { id }, data });
  }
}
