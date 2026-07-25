import { Module } from '@nestjs/common';
import { WeaponsService } from './weapons.service';
import { WeaponsController } from './weapons.controller';

@Module({
  providers: [WeaponsService],
  controllers: [WeaponsController],
  exports: [WeaponsService],
})
export class WeaponsModule {}
