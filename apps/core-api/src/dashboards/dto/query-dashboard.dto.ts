import { IsOptional, IsString } from 'class-validator';

export class QueryDashboardDto {
  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
