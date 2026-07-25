import { IsOptional, IsString } from 'class-validator';

export class QueryCrimeTrendReportDto {
  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
