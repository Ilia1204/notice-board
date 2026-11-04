import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdImagesInterceptor } from './ad-images.interceptor';
import { AdsService, type AdWithRelations } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { ListAdsDto } from './dto/list-ads.dto';
import { ModerateAdDto } from './dto/moderate-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // Список объявлений доступен всем, в том числе гостям
  @Get()
  findAll(@Query() query: ListAdsDto): Promise<AdWithRelations[]> {
    return this.adsService.findPublished(query);
  }

  // Адреса mine и moderation должны стоять раньше :id, иначе примутся за id
  @Get('moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR)
  findPending(): Promise<AdWithRelations[]> {
    return this.adsService.findPending();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: JwtPayload): Promise<AdWithRelations[]> {
    return this.adsService.findByAuthor(user.sub);
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard)
  findMineOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdWithRelations> {
    return this.adsService.findOwn(id, user.sub);
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

  // Опубликовать, отклонить или скрыть объявление может только модератор
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR)
  moderate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModerateAdDto,
  ): Promise<AdWithRelations> {
    return this.adsService.moderate(id, dto.status);
  }

  // Менять и удалять объявление может только его автор
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(AdImagesInterceptor)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ): Promise<AdWithRelations> {
    return this.adsService.update(id, user.sub, dto, files);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.adsService.remove(id, user.sub);
  }
}
