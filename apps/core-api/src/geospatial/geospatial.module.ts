import { Module } from '@nestjs/common';
import { GeospatialService } from './geospatial.service';
import { GeospatialController } from './geospatial.controller';

@Module({
  providers: [GeospatialService],
  controllers: [GeospatialController],
})
export class GeospatialModule {}
