import { Module } from '@nestjs/common';
import { AdsModule } from '../ads/ads.module';
import { UsersModule } from '../users/users.module';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  imports: [AdsModule, UsersModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
