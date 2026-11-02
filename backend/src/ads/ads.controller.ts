import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdImagesInterceptor } from './ad-images.interceptor';
import { AdsService, type AdWithRelations } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { ListAdsDto } from './dto/list-ads.dto';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // Список объявлений доступен всем, в том числе гостям
  @Get()
  findAll(@Query() query: ListAdsDto): Promise<AdWithRelations[]> {
    return this.adsService.findPublished(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<AdWithRelations> {
    return this.adsService.findPublishedOne(id);
  }

  // Публиковать объявления могут только вошедшие пользователи
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AdImagesInterceptor)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ): Promise<AdWithRelations> {
    return this.adsService.create(user.sub, dto, files);
  }
}
