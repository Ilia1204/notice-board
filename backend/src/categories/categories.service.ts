import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateCategoryDto): Promise<Category> {
    return this.save(() =>
      this.prisma.category.create({
        data: {
          name: dto.name.trim(),
          description: cleanDescription(dto.description),
        },
      }),
    );
  }

  update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    return this.save(() =>
      this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: cleanDescription(dto.description),
        },
      }),
    );
  }

  async remove(id: number): Promise<void> {
    await this.save(() => this.prisma.category.delete({ where: { id } }));
  }

  // Переводит ошибки Prisma в понятные HTTP-ответы
  private async save<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Категория с таким названием уже есть');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Категория не найдена');
        }
      }
      throw error;
    }
  }
}

// Пустое описание сохраняется как null, отсутствующее поле не меняется
function cleanDescription(description?: string): string | null | undefined {
  if (description === undefined) return undefined;
  return description.trim() || null;
}
