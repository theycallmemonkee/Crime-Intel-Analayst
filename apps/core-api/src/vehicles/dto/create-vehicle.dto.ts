import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @MinLength(4)
  registrationNumber!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  ownerPersonId?: string;
}
