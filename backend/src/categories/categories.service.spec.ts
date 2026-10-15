import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('error', {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prisma = {
    category: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CategoriesService);
  });

  it('возвращает категории по алфавиту', async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });

  it('создаёт категорию, убирая лишние пробелы', async () => {
    prisma.category.create.mockResolvedValue({ id: 1 });
    await service.create({ name: '  Книги ', description: '  ' });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Книги', description: null },
    });
  });

  it('не создаёт категорию с занятым названием', async () => {
    prisma.category.create.mockRejectedValue(prismaError('P2002'));
    await expect(service.create({ name: 'Книги' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('обновляет только переданные поля', async () => {
    prisma.category.update.mockResolvedValue({ id: 1 });
    await service.update(1, { description: 'Бумажные и электронные' });
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: undefined, description: 'Бумажные и электронные' },
    });
  });

  it('сообщает, что категория не найдена', async () => {
    prisma.category.update.mockRejectedValue(prismaError('P2025'));
    await expect(service.update(99, { name: 'Книги' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('удаляет категорию', async () => {
    prisma.category.delete.mockResolvedValue({ id: 1 });
    await expect(service.remove(1)).resolves.toBeUndefined();
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('пробрасывает прочие ошибки базы данных', async () => {
    prisma.category.delete.mockRejectedValue(new Error('connection lost'));
    await expect(service.remove(1)).rejects.toThrow('connection lost');
  });
});
