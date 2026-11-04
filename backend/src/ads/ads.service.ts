import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { ListAdsDto } from './dto/list-ads.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import {
  ImageStorage,
  MAX_IMAGES,
  TOO_MANY_IMAGES,
  type UploadedImage,
} from './image-storage.service';

export const adInclude = {
  category: { select: { id: true, name: true } },
  author: { select: { id: true, name: true } },
  images: {
    select: { id: true, filename: true, position: true },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.AdInclude;

export type AdWithRelations = Prisma.AdGetPayload<{
  include: typeof adInclude;
}>;

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageStorage,
  ) {}

  findPublished({ categoryId, q }: ListAdsDto): Promise<AdWithRelations[]> {
    return this.prisma.ad.findMany({
      where: {
        status: AdStatus.PUBLISHED,
        categoryId,
        title: q ? { contains: q, mode: 'insensitive' } : undefined,
      },
      include: adInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Неопубликованное объявление для посетителей как будто не существует
  async findPublishedOne(id: number): Promise<AdWithRelations> {
    const ad = await this.prisma.ad.findFirst({
      where: { id, status: AdStatus.PUBLISHED },
      include: adInclude,
    });
    if (!ad) throw new NotFoundException('Объявление не найдено');
    return ad;
  }

  // Автору видны все его объявления, в том числе непрошедшие проверку
  findByAuthor(authorId: number): Promise<AdWithRelations[]> {
    return this.prisma.ad.findMany({
      where: { authorId },
      include: adInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOwn(id: number, authorId: number): Promise<AdWithRelations> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: adInclude,
    });
    if (!ad) throw new NotFoundException('Объявление не найдено');
    if (ad.authorId !== authorId) {
      throw new ForbiddenException('Можно менять только свои объявления');
    }
    return ad;
  }

  create(
    authorId: number,
    dto: CreateAdDto,
    files: UploadedImage[] = [],
  ): Promise<AdWithRelations> {
    return this.withImages(files, (filenames) =>
      this.prisma.ad.create({
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          price: dto.price ?? null,
          categoryId: dto.categoryId,
          authorId,
          images: {
            create: filenames.map((filename, position) => ({
              filename,
              position,
            })),
          },
        },
        include: adInclude,
      }),
    );
  }

  async update(
    id: number,
    authorId: number,
    dto: UpdateAdDto,
    files: UploadedImage[] = [],
  ): Promise<AdWithRelations> {
    const ad = await this.findOwn(id, authorId);
    const removeIds = dto.removeImageIds ?? [];
    const removed = ad.images.filter((image) => removeIds.includes(image.id));
    if (ad.images.length - removed.length + files.length > MAX_IMAGES) {
      throw new BadRequestException(TOO_MANY_IMAGES);
    }
    const nextPosition = Math.max(-1, ...ad.images.map((i) => i.position)) + 1;

    const updated = await this.withImages(files, (filenames) =>
      this.prisma.ad.update({
        where: { id },
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          price: dto.price ?? null,
          categoryId: dto.categoryId,
          // Изменённый текст модератор ещё не видел
          status: AdStatus.PENDING,
          images: {
            deleteMany: { id: { in: removed.map((image) => image.id) } },
            create: filenames.map((filename, i) => ({
              filename,
              position: nextPosition + i,
            })),
          },
        },
        include: adInclude,
      }),
    );
    await this.images.remove(removed.map((image) => image.filename));
    return updated;
  }

  async remove(id: number, authorId: number): Promise<void> {
    const ad = await this.findOwn(id, authorId);
    await this.prisma.ad.delete({ where: { id } });
    await this.images.remove(ad.images.map((image) => image.filename));
  }

  // Сохраняет фото и записывает объявление в базу
  private async withImages(
    files: UploadedImage[],
    write: (filenames: string[]) => Promise<AdWithRelations>,
  ): Promise<AdWithRelations> {
    this.images.validate(files);
    const filenames = await this.images.save(files);
    try {
      return await write(filenames);
    } catch (error) {
      // Объявление не сохранилось — его фото на диске больше не нужны
      await this.images.remove(filenames);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('Такой категории нет');
      }
      throw error;
    }
  }
}
