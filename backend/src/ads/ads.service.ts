import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { ImageStorage, type UploadedImage } from './image-storage.service';

// Вместе с объявлением отдаём категорию, имя автора и фото — без email и пароля
export const adInclude = {
  category: { select: { id: true, name: true } },
  author: { select: { id: true, name: true } },
  images: {
    select: { id: true, filename: true },
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

  // Новое объявление получает статус «на модерации» (PENDING по умолчанию)
  async create(
    authorId: number,
    dto: CreateAdDto,
    files: UploadedImage[] = [],
  ): Promise<AdWithRelations> {
    this.images.validate(files);
    const filenames = await this.images.save(files);
    try {
      return await this.prisma.ad.create({
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
      });
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
