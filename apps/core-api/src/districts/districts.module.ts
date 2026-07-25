import { Module } from '@nestjs/common';
import { DistrictsService } from './districts.service';
import { DistrictsController } from './districts.controller';

@Module({
  providers: [DistrictsService],
  controllers: [DistrictsController],
  exports: [DistrictsService],
})
export class DistrictsModule {}
