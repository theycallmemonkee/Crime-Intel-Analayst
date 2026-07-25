import { IsString, MinLength } from 'class-validator';

export class CreateDistrictDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  code!: string;
}
