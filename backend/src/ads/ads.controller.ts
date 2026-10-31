import {
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdsService, type AdWithRelations } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { MAX_IMAGE_SIZE, MAX_IMAGES } from './image-storage.service';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // Публиковать объявления могут только вошедшие пользователи.
  // Лимиты multer — с запасом: понятные сообщения об ошибках даёт ImageStorage
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('images', MAX_IMAGES * 2, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE * 2 },
    }),
  )
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ): Promise<AdWithRelations> {
    return this.adsService.create(user.sub, dto, files);
  }
}
