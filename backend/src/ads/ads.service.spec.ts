import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  const prisma = {
    ad: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
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

  it('в списке только опубликованные объявления, новые сверху', async () => {
    prisma.ad.findMany.mockResolvedValue([]);
    await service.findPublished({});
    expect(prisma.ad.findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED', categoryId: undefined, title: undefined },
      include: adInclude,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('фильтрует список по рубрике и названию без учёта регистра', async () => {
    prisma.ad.findMany.mockResolvedValue([]);
    await service.findPublished({ categoryId: 3, q: 'велик' });
    expect(prisma.ad.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PUBLISHED',
          categoryId: 3,
          title: { contains: 'велик', mode: 'insensitive' },
        },
      }),
    );
  });

  it('открывает опубликованное объявление', async () => {
    prisma.ad.findFirst.mockResolvedValue({ id: 5 });
    await expect(service.findPublishedOne(5)).resolves.toEqual({ id: 5 });
    expect(prisma.ad.findFirst).toHaveBeenCalledWith({
      where: { id: 5, status: 'PUBLISHED' },
      include: adInclude,
    });
  });

  it('не открывает несуществующее или неопубликованное объявление', async () => {
    prisma.ad.findFirst.mockResolvedValue(null);
    await expect(service.findPublishedOne(5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
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

  describe('модерация', () => {
    it('очередь: только объявления на проверке, старые сверху', async () => {
      prisma.ad.findMany.mockResolvedValue([]);
      await service.findPending();
      expect(prisma.ad.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        include: adInclude,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('меняет статус объявления', async () => {
      prisma.ad.update.mockResolvedValue({ id: 5, status: 'REJECTED' });
      await expect(service.moderate(5, 'REJECTED')).resolves.toMatchObject({
        status: 'REJECTED',
      });
      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { status: 'REJECTED' },
        include: adInclude,
      });
    });

    it('сообщает, если объявления уже нет', async () => {
      prisma.ad.update.mockRejectedValue(prismaError('P2025'));
      await expect(service.moderate(5, 'PUBLISHED')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('пробрасывает прочие ошибки базы данных', async () => {
      prisma.ad.update.mockRejectedValue(new Error('connection lost'));
      await expect(service.moderate(5, 'PUBLISHED')).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('свои объявления', () => {
    const stored = {
      id: 5,
      authorId: 7,
      images: [
        { id: 1, filename: 'a.jpg', position: 0 },
        { id: 2, filename: 'b.jpg', position: 3 },
      ],
    };

    beforeEach(() => {
      prisma.ad.findUnique.mockResolvedValue(stored);
      prisma.ad.update.mockResolvedValue(stored);
    });

    it('автор видит все свои объявления, новые сверху', async () => {
      prisma.ad.findMany.mockResolvedValue([]);
      await service.findByAuthor(7);
      expect(prisma.ad.findMany).toHaveBeenCalledWith({
        where: { authorId: 7 },
        include: adInclude,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('не находит несуществующее объявление', async () => {
      prisma.ad.findUnique.mockResolvedValue(null);
      await expect(service.findOwn(5, 7)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('не отдаёт чужое объявление', async () => {
      await expect(service.findOwn(5, 8)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('изменённое объявление снова уходит на проверку', async () => {
      await service.update(5, 7, { ...bike, title: ' Самокат ' });
      expect(prisma.ad.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          title: 'Самокат',
          description: bike.description,
          price: null,
          categoryId: 1,
          status: 'PENDING',
          images: { deleteMany: { id: { in: [] } }, create: [] },
        },
        include: adInclude,
      });
    });

    it('чужое объявление изменить нельзя', async () => {
      await expect(service.update(5, 8, bike, [photo])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(images.save).not.toHaveBeenCalled();
      expect(prisma.ad.update).not.toHaveBeenCalled();
    });

    it('новые фото встают в конец, убранные удаляются с диска', async () => {
      images.save.mockResolvedValue(['c.jpg']);
      await service.update(5, 7, { ...bike, removeImageIds: [1] }, [photo]);
      expect(prisma.ad.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: {
              deleteMany: { id: { in: [1] } },
              create: [{ filename: 'c.jpg', position: 4 }],
            },
          }) as unknown,
        }),
      );
      expect(images.remove).toHaveBeenCalledWith(['a.jpg']);
    });

    it('не трогает фото чужих объявлений', async () => {
      await service.update(5, 7, { ...bike, removeImageIds: [99] });
      expect(prisma.ad.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: { deleteMany: { id: { in: [] } }, create: [] },
          }) as unknown,
        }),
      );
      expect(images.remove).toHaveBeenCalledWith([]);
    });

    it('считает лимит вместе с оставшимися фото', async () => {
      const files = Array.from({ length: 9 }, () => photo);
      await expect(service.update(5, 7, bike, files)).rejects.toThrow(
        'Можно прикрепить не больше 10 фото',
      );
      expect(images.save).not.toHaveBeenCalled();
    });

    it('при ошибке базы оставляет старые фото и удаляет новые', async () => {
      images.save.mockResolvedValue(['c.jpg']);
      prisma.ad.update.mockRejectedValue(prismaError('P2003'));
      await expect(
        service.update(5, 7, { ...bike, removeImageIds: [1] }, [photo]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(images.remove).toHaveBeenCalledTimes(1);
      expect(images.remove).toHaveBeenCalledWith(['c.jpg']);
    });

    it('удаляет объявление вместе с фото на диске', async () => {
      await service.remove(5, 7);
      expect(prisma.ad.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(images.remove).toHaveBeenCalledWith(['a.jpg', 'b.jpg']);
    });

    it('чужое объявление удалить нельзя', async () => {
      await expect(service.remove(5, 8)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.ad.delete).not.toHaveBeenCalled();
      expect(images.remove).not.toHaveBeenCalled();
    });
  });
});
