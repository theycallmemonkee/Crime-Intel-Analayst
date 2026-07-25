import { IsLatitude, IsLongitude, IsISO8601, IsString, MinLength } from 'class-validator';

export class CreateCrimeDto {
  @IsString()
  categoryId!: string;

  @IsString()
  stationId!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsString()
  @MinLength(3)
  addressLine!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  // Every crime is filed with an FIR narrative at creation time — this
  // mirrors the real workflow (a crime record without an FIR doesn't really
  // exist yet) rather than treating FIR as a separate optional step.
  @IsString()
  @MinLength(10)
  firNarrative!: string;
}
