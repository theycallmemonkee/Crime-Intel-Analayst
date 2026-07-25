import { IsString } from 'class-validator';

export class LinkWeaponDto {
  @IsString()
  weaponId!: string;
}
