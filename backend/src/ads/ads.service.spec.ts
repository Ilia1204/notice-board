import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { adInclude, AdsService } from './ads.service';
import { ImageStorage } from './image-storage.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('error', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

const bike = {
  title: 'Велосипед',
  description: 'Горный велосипед',
  categoryId: 1,
};
const photo = { mimetype: 'image/jpeg', size: 100, buffer: Buffer.from('') };

describe('AdsService', () => {
  let service: AdsService;
  const prisma = { ad: { create: jest.fn() } };
  const images = {
    validate: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    images.save.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ImageStorage, useValue: images },
      ],
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
        images: { create: [] },
      },
      include: adInclude,
    });
  });

  it('без цены сохраняет объявление как договорное', async () => {
    prisma.ad.create.mockResolvedValue({ id: 1 });
    await service.create(7, bike);
    expect(prisma.ad.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ price: null }) as unknown,
      }),
    );
  });

  it('сохраняет фото в порядке загрузки', async () => {
    images.save.mockResolvedValue(['a.jpg', 'b.jpg']);
    prisma.ad.create.mockResolvedValue({ id: 1 });
    await service.create(7, bike, [photo, photo]);

    expect(images.validate).toHaveBeenCalledWith([photo, photo]);
    expect(prisma.ad.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          images: {
            create: [
              { filename: 'a.jpg', position: 0 },
              { filename: 'b.jpg', position: 1 },
            ],
          },
        }) as unknown,
      }),
    );
  });

  it('не сохраняет файлы, если фото не прошли проверку', async () => {
    images.validate.mockImplementationOnce(() => {
      throw new BadRequestException('Неверный формат');
    });
    await expect(service.create(7, bike, [photo])).rejects.toThrow(
      'Неверный формат',
    );
    expect(images.save).not.toHaveBeenCalled();
    expect(prisma.ad.create).not.toHaveBeenCalled();
  });

  it('отклоняет несуществующую категорию и удаляет загруженные фото', async () => {
    images.save.mockResolvedValue(['a.jpg']);
    prisma.ad.create.mockRejectedValue(prismaError('P2003'));
    await expect(
      service.create(7, { ...bike, categoryId: 99 }, [photo]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(images.remove).toHaveBeenCalledWith(['a.jpg']);
  });

  it('пробрасывает прочие ошибки базы данных', async () => {
    prisma.ad.create.mockRejectedValue(new Error('connection lost'));
    await expect(service.create(7, bike)).rejects.toThrow('connection lost');
  });
});
