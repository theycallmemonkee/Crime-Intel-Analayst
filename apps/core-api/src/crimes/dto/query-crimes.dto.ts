import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { InvestigationStatus } from '@prisma/client';

export class QueryCrimesDto {
  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(InvestigationStatus)
  status?: InvestigationStatus;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  pageSize?: string;
}
