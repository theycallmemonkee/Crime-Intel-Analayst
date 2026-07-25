import { IsEnum } from 'class-validator';
import { InvestigationStatus } from '@prisma/client';

export class UpdateCrimeStatusDto {
  @IsEnum(InvestigationStatus)
  status!: InvestigationStatus;
}
