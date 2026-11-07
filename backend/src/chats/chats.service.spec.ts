import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ChatsService } from './chats.service';

describe('ChatsService', () => {
  let service: ChatsService;
  const prisma = {
    ad: { findFirst: jest.fn() },
    chat: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    message: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  // Покупатель 5 пишет продавцу 9 по объявлению 7
  const message = { id: 1, chatId: 3, senderId: 5, text: 'Привет' };
  const chat = {
    id: 3,
    adId: 7,
    buyerId: 5,
    ad: { id: 7, title: 'Велосипед', author: { id: 9, name: 'Анна' } },
    buyer: { id: 5, name: 'Иван' },
    messages: [message],
    updatedAt: new Date('2026-11-07T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ChatsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ChatsService);
  });

  it('собеседник — другая сторона диалога', async () => {
    prisma.chat.findMany.mockResolvedValue([chat]);
    const [forBuyer] = await service.findAll(5);
    expect(forBuyer).toEqual({
      id: 3,
      ad: { id: 7, title: 'Велосипед' },
      companion: { id: 9, name: 'Анна' },
      lastMessage: message,
      updatedAt: chat.updatedAt,
    });
    const [forSeller] = await service.findAll(9);
    expect(forSeller.companion).toEqual({ id: 5, name: 'Иван' });
  });

  it('ищет диалоги покупателя и продавца, только с сообщениями', async () => {
    prisma.chat.findMany.mockResolvedValue([]);
    await service.findAll(5);
    expect(prisma.chat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ buyerId: 5 }, { ad: { authorId: 5 } }],
          messages: { some: {} },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('открывает диалог по опубликованному объявлению без дублей', async () => {
    prisma.ad.findFirst.mockResolvedValue({ id: 7, authorId: 9 });
    prisma.chat.upsert.mockResolvedValue({ ...chat, messages: [] });
    const result = await service.open(5, 7);
    expect(result.lastMessage).toBeNull();
    expect(prisma.ad.findFirst).toHaveBeenCalledWith({
      where: { id: 7, status: 'PUBLISHED' },
    });
    expect(prisma.chat.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adId_buyerId: { adId: 7, buyerId: 5 } },
        create: { adId: 7, buyerId: 5 },
        update: {},
      }),
    );
  });

  it('не открывает диалог по скрытому объявлению и с самим собой', async () => {
    prisma.ad.findFirst.mockResolvedValue(null);
    await expect(service.open(5, 7)).rejects.toThrow(NotFoundException);
    prisma.ad.findFirst.mockResolvedValue({ id: 7, authorId: 9 });
    await expect(service.open(9, 7)).rejects.toThrow(BadRequestException);
    expect(prisma.chat.upsert).not.toHaveBeenCalled();
  });

  it('отдаёт историю по порядку отправки', async () => {
    prisma.chat.findUnique.mockResolvedValue(chat);
    prisma.message.findMany.mockResolvedValue([message]);
    await expect(service.findMessages(3, 9)).resolves.toEqual([message]);
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { chatId: 3 },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('не пускает в чужой и несуществующий диалог', async () => {
    prisma.chat.findUnique.mockResolvedValue(chat);
    await expect(service.findMessages(3, 42)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.send(3, 42, 'Привет')).rejects.toThrow(
      ForbiddenException,
    );
    prisma.chat.findUnique.mockResolvedValue(null);
    await expect(service.findOne(3, 5)).rejects.toThrow(NotFoundException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('сохраняет сообщение и поднимает диалог наверх', async () => {
    prisma.chat.findUnique.mockResolvedValue(chat);
    prisma.message.create.mockResolvedValue(message);
    await expect(service.send(3, 5, 'Привет')).resolves.toEqual(message);
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { chatId: 3, senderId: 5, text: 'Привет' },
    });
    expect(prisma.chat.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { updatedAt: expect.any(Date) as Date },
    });
  });
});
