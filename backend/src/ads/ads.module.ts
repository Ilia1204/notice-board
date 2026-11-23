import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsGateway } from './ads.gateway';
import { AdsService } from './ads.service';
import { ImageStorage } from './image-storage.service';

@Module({
  controllers: [AdsController],
  providers: [AdsService, ImageStorage, AdsGateway],
  exports: [AdsService],
})
export class AdsModule {}
