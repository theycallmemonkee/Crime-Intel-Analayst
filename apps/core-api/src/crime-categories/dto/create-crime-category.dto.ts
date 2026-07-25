import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateCrimeCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  severityWeight?: number;
}
