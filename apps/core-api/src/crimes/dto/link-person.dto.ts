import { IsEnum, IsString } from 'class-validator';
import { CrimePersonRole } from '@prisma/client';

export class LinkPersonDto {
  @IsString()
  personId!: string;

  @IsEnum(CrimePersonRole)
  role!: CrimePersonRole;
}
