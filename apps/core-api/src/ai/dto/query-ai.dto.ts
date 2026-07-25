import { IsIn, IsOptional, IsString } from 'class-validator';

export class QueryTrendDto {
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
  @IsString()
  monthsAhead?: string;
}

export class QueryAreaLevelDto {
  @IsOptional()
  @IsIn(['DISTRICT', 'STATION'])
  level?: 'DISTRICT' | 'STATION';

  @IsOptional()
  @IsString()
  limit?: string;
}
