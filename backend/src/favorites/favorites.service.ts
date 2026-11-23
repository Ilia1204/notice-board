import { Injectable } from '@nestjs/common';
import { AdStatus } from '@prisma/client';
import {
  adInclude,
  AdsService,
  type AdWithRelations,
} from '../ads/ads.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: AdsService,
  ) {}

  // Снятое с публикации объявление не показываем, но и не забываем:
  // после повторной проверки оно вернётся в избранное
  async findAll(userId: number): Promise<AdWithRelations[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, ad: { status: AdStatus.PUBLISHED } },
      include: { ad: { include: adInclude } },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((favorite) => favorite.ad);
  }

  // Повторное добавление не считается ошибкой
  async add(userId: number, adId: number): Promise<void> {
    await this.ads.findPublishedOne(adId);
    await this.prisma.favorite.upsert({
      where: { userId_adId: { userId, adId } },
      create: { userId, adId },
      update: {},
    });
  }

  async remove(userId: number, adId: number): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, adId } });
  }
}
