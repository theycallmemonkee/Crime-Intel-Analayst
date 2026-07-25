import { Module } from '@nestjs/common';
import { CrimeCategoriesService } from './crime-categories.service';
import { CrimeCategoriesController } from './crime-categories.controller';

@Module({
  providers: [CrimeCategoriesService],
  controllers: [CrimeCategoriesController],
  exports: [CrimeCategoriesService],
})
export class CrimeCategoriesModule {}
