import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAllSafe() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { district: true, station: true },
    });
    return users.map(({ passwordHash: _passwordHash, ...safe }) => safe);
  }
}
