import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { ImageStorage } from './image-storage.service';

@Module({
  controllers: [AdsController],
  providers: [AdsService, ImageStorage],
})
export class AdsModule {}
