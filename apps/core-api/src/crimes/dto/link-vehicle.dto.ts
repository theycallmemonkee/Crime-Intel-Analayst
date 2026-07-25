import { IsEnum, IsString } from 'class-validator';
import { VehicleInvolvementRole } from '@prisma/client';

export class LinkVehicleDto {
  @IsString()
  vehicleId!: string;

  @IsEnum(VehicleInvolvementRole)
  role!: VehicleInvolvementRole;
}
