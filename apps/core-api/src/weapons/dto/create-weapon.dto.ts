import { IsOptional, IsString } from 'class-validator';

export class CreateWeaponDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;
}
