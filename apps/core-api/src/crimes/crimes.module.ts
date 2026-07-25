import { Module } from '@nestjs/common';
import { CrimesService } from './crimes.service';
import { CrimesController } from './crimes.controller';

@Module({
  providers: [CrimesService],
  controllers: [CrimesController],
  exports: [CrimesService],
})
export class CrimesModule {}
