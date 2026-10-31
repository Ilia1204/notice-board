import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto } from './dto/create-ad.dto';

// Вместе с объявлением отдаём категорию и имя автора — без email и пароля
export const adInclude = {
  category: { select: { id: true, name: true } },
  author: { select: { id: true, name: true } },
} satisfies Prisma.AdInclude;

export type AdWithRelations = Prisma.AdGetPayload<{
  include: typeof adInclude;
}>;

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: number, dto: CreateAdDto): Promise<AdWithRelations> {
    try {
      return await this.prisma.ad.create({
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          price: dto.price ?? null,
          categoryId: dto.categoryId,
          authorId,
        },
        include: adInclude,
      });
    } catch (error) {
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
