import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';

interface AuthenticatedUser {
  userId: string;
  username: string;
  role: Role;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Any authenticated role can read their own profile.
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const record = await this.usersService.findById(user.userId);
    if (!record) return null;
    const { passwordHash: _passwordHash, ...safe } = record;
    return safe;
  }

  // Demonstrates role-gated access: only Admins can list all users.
  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return this.usersService.findAllSafe();
  }
}
