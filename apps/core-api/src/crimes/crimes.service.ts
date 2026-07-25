import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCanWriteToStation, districtScopeFilter, RequestUser } from '../common/jurisdiction.util';
import { CreateCrimeDto } from './dto/create-crime.dto';
import { QueryCrimesDto } from './dto/query-crimes.dto';
import { UpdateCrimeStatusDto } from './dto/update-crime-status.dto';
import { LinkPersonDto } from './dto/link-person.dto';
import { LinkVehicleDto } from './dto/link-vehicle.dto';
import { LinkWeaponDto } from './dto/link-weapon.dto';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

const DETAIL_INCLUDE = {
  category: true,
  station: { include: { district: true } },
  district: true,
  fir: { include: { filedBy: { select: { id: true, username: true, fullName: true } } } },
  personLinks: { include: { person: true } },
  vehicleLinks: { include: { vehicle: true } },
  weaponLinks: { include: { weapon: true } },
  evidenceItems: { include: { collectedBy: { select: { id: true, username: true, fullName: true } } } },
} satisfies Prisma.CrimeInclude;

@Injectable()
export class CrimesService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: RequestUser, query: QueryCrimesDto) {
    const page = query.page ? Number(query.page) : 1;
    const pageSize = query.pageSize ? Number(query.pageSize) : 25;

    const where: Prisma.CrimeWhereInput = {
      ...districtScopeFilter(user),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.stationId ? { stationId: query.stationId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            occurredAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.crime.count({ where }),
      this.prisma.crime.findMany({
        where,
        include: { category: true, station: true, district: true, fir: true },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items };
  }

  async findOne(user: RequestUser, id: string) {
    const crime = await this.prisma.crime.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!crime) throw new NotFoundException('Crime not found');

    const scope = districtScopeFilter(user);
    if (scope && crime.districtId !== scope.districtId) {
      throw new NotFoundException('Crime not found'); // don't leak existence outside jurisdiction
    }
    return crime;
  }

  async create(user: RequestUser, dto: CreateCrimeDto) {
    const station = await this.prisma.policeStation.findUnique({ where: { id: dto.stationId } });
    if (!station) throw new BadRequestException('Unknown stationId');
    assertCanWriteToStation(user, station.id);

    const firNumber = await this.generateFirNumber(station.id, station.code, new Date(dto.occurredAt));

    return this.prisma.crime.create({
      data: {
        categoryId: dto.categoryId,
        stationId: station.id,
        districtId: station.districtId,
        occurredAt: new Date(dto.occurredAt),
        description: dto.description,
        addressLine: dto.addressLine,
        latitude: dto.latitude,
        longitude: dto.longitude,
        fir: {
          create: {
            firNumber,
            narrative: dto.firNarrative,
            filedById: user.userId,
          },
        },
      },
      include: DETAIL_INCLUDE,
    });
  }

  async updateStatus(user: RequestUser, id: string, dto: UpdateCrimeStatusDto) {
    const crime = await this.getOwnedCrimeOrThrow(user, id);
    return this.prisma.crime.update({
      where: { id: crime.id },
      data: { status: dto.status },
      include: DETAIL_INCLUDE,
    });
  }

  async linkPerson(user: RequestUser, crimeId: string, dto: LinkPersonDto) {
    const crime = await this.getOwnedCrimeOrThrow(user, crimeId);
    await this.prisma.crimePerson.create({
      data: { crimeId: crime.id, personId: dto.personId, role: dto.role },
    });
    return this.findOne(user, crime.id);
  }

  async unlinkPerson(user: RequestUser, crimeId: string, linkId: string) {
    const crime = await this.getOwnedCrimeOrThrow(user, crimeId);
    await this.prisma.crimePerson.delete({ where: { id: linkId } });
    return this.findOne(user, crime.id);
  }

  async linkVehicle(user: RequestUser, crimeId: string, dto: LinkVehicleDto) {
    const crime = await this.getOwnedCrimeOrThrow(user, crimeId);
    await this.prisma.crimeVehicle.create({
      data: { crimeId: crime.id, vehicleId: dto.vehicleId, role: dto.role },
    });
    return this.findOne(user, crime.id);
  }

  async linkWeapon(user: RequestUser, crimeId: string, dto: LinkWeaponDto) {
    const crime = await this.getOwnedCrimeOrThrow(user, crimeId);
    await this.prisma.crimeWeapon.create({
      data: { crimeId: crime.id, weaponId: dto.weaponId },
    });
    return this.findOne(user, crime.id);
  }

  async addEvidence(user: RequestUser, crimeId: string, dto: CreateEvidenceDto) {
    const crime = await this.getOwnedCrimeOrThrow(user, crimeId);
    await this.prisma.evidence.create({
      data: {
        crimeId: crime.id,
        type: dto.type,
        description: dto.description,
        fileHash: dto.fileHash,
        collectedById: user.userId,
      },
    });
    return this.findOne(user, crime.id);
  }

  // Shared by every write path below crime-level: loads the crime (404 if
  // missing) and enforces station-level write jurisdiction in one place.
  private async getOwnedCrimeOrThrow(user: RequestUser, crimeId: string) {
    const crime = await this.prisma.crime.findUnique({ where: { id: crimeId } });
    if (!crime) throw new NotFoundException('Crime not found');
    assertCanWriteToStation(user, crime.stationId);
    return crime;
  }

  private async generateFirNumber(stationId: string, stationCode: string, occurredAt: Date): Promise<string> {
    // Sequence is per-station, not per-(station,year): the synthetic seed
    // data assigns FIR sequence numbers in generation order per station and
    // stamps each with that crime's own occurredAt year, so two FIRs from the
    // same year don't necessarily have consecutive sequence numbers. Counting
    // only within the target year would eventually collide with an existing
    // number; counting all FIRs ever filed at the station matches the
    // invariant that's actually unique (see prisma/seed.ts).
    const year = occurredAt.getFullYear();
    const count = await this.prisma.fir.count({ where: { crime: { stationId } } });
    return `${stationCode}/${year}/${String(count + 1).padStart(4, '0')}`;
  }
}
