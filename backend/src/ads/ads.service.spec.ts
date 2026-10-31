import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { adInclude, AdsService } from './ads.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('error', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

describe('AdsService', () => {
  let service: AdsService;
  const prisma = { ad: { create: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AdsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AdsService);
  });

  it('публикует объявление от имени автора, убирая лишние пробелы', async () => {
    prisma.ad.create.mockResolvedValue({ id: 1 });
    await service.create(7, {
      title: '  Велосипед ',
      description: ' Горный, 21 скорость ',
      price: 15000,
      categoryId: 3,
    });
    expect(prisma.ad.create).toHaveBeenCalledWith({
      data: {
        title: 'Велосипед',
        description: 'Горный, 21 скорость',
        price: 15000,
        categoryId: 3,
        authorId: 7,
      },
      include: adInclude,
    });
  });

  it('без цены сохраняет объявление как договорное', async () => {
    prisma.ad.create.mockResolvedValue({ id: 1 });
    await service.create(7, {
      title: 'Ремонт',
      description: 'Ремонт квартир под ключ',
      categoryId: 4,
    });
    expect(prisma.ad.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ price: null }) as unknown,
      }),
    );
  });

  it('отклоняет несуществующую категорию', async () => {
    prisma.ad.create.mockRejectedValue(prismaError('P2003'));
    await expect(
      service.create(7, {
        title: 'Велосипед',
        description: 'Горный велосипед',
        categoryId: 99,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('пробрасывает прочие ошибки базы данных', async () => {
    prisma.ad.create.mockRejectedValue(new Error('connection lost'));
    await expect(
      service.create(7, {
        title: 'Велосипед',
        description: 'Горный велосипед',
        categoryId: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});
