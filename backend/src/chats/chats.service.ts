import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdStatus, Prisma, type Message } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const chatInclude = {
  ad: {
    select: {
      id: true,
      title: true,
      author: { select: { id: true, name: true } },
    },
  },
  buyer: { select: { id: true, name: true } },
  messages: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.ChatInclude;

type ChatWithRelations = Prisma.ChatGetPayload<{ include: typeof chatInclude }>;

// Диалог глазами одного из участников: собеседник — это всегда «другая сторона»
export interface ChatSummary {
  id: number;
  ad: { id: number; title: string };
  companion: { id: number; name: string };
  lastMessage: Message | null;
  updatedAt: Date;
}

// Сохранённое сообщение и кому его доставить: покупателю и автору объявления
export interface SentMessage {
  message: Message;
  memberIds: number[];
}

const toSummary = (chat: ChatWithRelations, userId: number): ChatSummary => ({
  id: chat.id,
  ad: { id: chat.ad.id, title: chat.ad.title },
  companion: chat.buyerId === userId ? chat.ad.author : chat.buyer,
  lastMessage: chat.messages[0] ?? null,
  updatedAt: chat.updatedAt,
});

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Диалоги, где пользователь покупатель или автор объявления; пустые не показываем
  async findAll(userId: number): Promise<ChatSummary[]> {
    const chats = await this.prisma.chat.findMany({
      where: {
        OR: [{ buyerId: userId }, { ad: { authorId: userId } }],
        messages: { some: {} },
      },
      include: chatInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return chats.map((chat) => toSummary(chat, userId));
  }

  // Повторное открытие возвращает уже начатый диалог
  async open(userId: number, adId: number): Promise<ChatSummary> {
    const ad = await this.prisma.ad.findFirst({
      where: { id: adId, status: AdStatus.PUBLISHED },
    });
    if (!ad) throw new NotFoundException('Объявление не найдено');
    if (ad.authorId === userId) {
      throw new BadRequestException('Нельзя написать самому себе');
    }
    const chat = await this.prisma.chat.upsert({
      where: { adId_buyerId: { adId, buyerId: userId } },
      create: { adId, buyerId: userId },
      update: {},
      include: chatInclude,
    });
    return toSummary(chat, userId);
  }

  async findOne(id: number, userId: number): Promise<ChatSummary> {
    return toSummary(await this.findOwn(id, userId), userId);
  }

  async findMessages(id: number, userId: number): Promise<Message[]> {
    await this.findOwn(id, userId);
    return this.prisma.message.findMany({
      where: { chatId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async send(id: number, userId: number, text: string): Promise<SentMessage> {
    const chat = await this.findOwn(id, userId);
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { chatId: id, senderId: userId, text },
      }),
      // Диалог с новым сообщением поднимается наверх списка
      this.prisma.chat.update({
        where: { id },
        data: { updatedAt: new Date() },
      }),
    ]);
    return { message, memberIds: [chat.buyerId, chat.ad.author.id] };
  }

  // Чужую переписку читать нельзя
  private async findOwn(
    id: number,
    userId: number,
  ): Promise<ChatWithRelations> {
    const chat = await this.prisma.chat.findUnique({
      where: { id },
      include: chatInclude,
    });
    if (!chat) throw new NotFoundException('Диалог не найден');
    if (chat.buyerId !== userId && chat.ad.author.id !== userId) {
      throw new ForbiddenException('Это чужой диалог');
    }
    return chat;
  }
}
