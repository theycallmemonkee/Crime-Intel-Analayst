import { IsLatitude, IsLongitude, IsString, MinLength } from 'class-validator';

export class CreateStationDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  districtId!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}
