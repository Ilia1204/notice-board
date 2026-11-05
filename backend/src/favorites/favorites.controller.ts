import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AdWithRelations } from '../ads/ads.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';

// Избранное есть только у вошедших пользователей
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<AdWithRelations[]> {
    return this.favoritesService.findAll(user.sub);
  }

  @Put(':adId')
  @HttpCode(204)
  add(
    @CurrentUser() user: JwtPayload,
    @Param('adId', ParseIntPipe) adId: number,
  ): Promise<void> {
    return this.favoritesService.add(user.sub, adId);
  }

  @Delete(':adId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('adId', ParseIntPipe) adId: number,
  ): Promise<void> {
    return this.favoritesService.remove(user.sub, adId);
  }
}
