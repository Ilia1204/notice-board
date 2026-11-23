import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { adInclude, AdsService } from '../ads/ads.service';
import { PrismaService } from '../prisma/prisma.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  const ads = { findPublishedOne: jest.fn() };
  const prisma = {
    favorite: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdsService, useValue: ads },
      ],
    }).compile();
    service = moduleRef.get(FavoritesService);
  });

  it('отдаёт только опубликованные объявления, свежие сверху', async () => {
    const ad = { id: 7, title: 'Велосипед' };
    prisma.favorite.findMany.mockResolvedValue([{ userId: 5, adId: 7, ad }]);
    await expect(service.findAll(5)).resolves.toEqual([ad]);
    expect(prisma.favorite.findMany).toHaveBeenCalledWith({
      where: { userId: 5, ad: { status: 'PUBLISHED' } },
      include: { ad: { include: adInclude } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('добавляет опубликованное объявление без дублей', async () => {
    ads.findPublishedOne.mockResolvedValue({ id: 7 });
    await service.add(5, 7);
    expect(ads.findPublishedOne).toHaveBeenCalledWith(7);
    expect(prisma.favorite.upsert).toHaveBeenCalledWith({
      where: { userId_adId: { userId: 5, adId: 7 } },
      create: { userId: 5, adId: 7 },
      update: {},
    });
  });

  it('не добавляет неопубликованное или несуществующее объявление', async () => {
    ads.findPublishedOne.mockRejectedValue(
      new NotFoundException('Объявление не найдено'),
    );
    await expect(service.add(5, 7)).rejects.toThrow(NotFoundException);
    expect(prisma.favorite.upsert).not.toHaveBeenCalled();
  });

  it('удаляет только запись этого пользователя', async () => {
    await service.remove(5, 7);
    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 5, adId: 7 },
    });
  });
});
