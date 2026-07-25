import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class CreatePersonDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsString()
  alias?: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;
}
