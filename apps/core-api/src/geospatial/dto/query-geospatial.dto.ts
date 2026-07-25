import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class QueryGeospatialDto {
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
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
