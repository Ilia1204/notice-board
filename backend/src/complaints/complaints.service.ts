import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdStatus,
  ComplaintReason,
  ComplaintStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateComplaintDto } from './dto/create-complaint.dto';

export const complaintInclude = {
  reporter: { select: { id: true, name: true } },
  ad: {
    select: {
      id: true,
      title: true,
      status: true,
      author: { select: { id: true, name: true } },
    },
  },
  user: { select: { id: true, name: true } },
} satisfies Prisma.ComplaintInclude;

export type ComplaintWithRelations = Prisma.ComplaintGetPayload<{
  include: typeof complaintInclude;
}>;

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    reporterId: number,
    dto: CreateComplaintDto,
  ): Promise<ComplaintWithRelations> {
    const { adId, userId, reason } = dto;
    const comment = dto.comment || null;
    if ((adId === undefined) === (userId === undefined)) {
      throw new BadRequestException('Укажите объявление или пользователя');
    }
    if (reason === ComplaintReason.OTHER && !comment) {
      throw new BadRequestException('Опишите, что не так');
    }

    await this.checkTarget(reporterId, adId, userId);

    // Пока жалоба не рассмотрена, вторую на то же самое не принимаем
    const open = await this.prisma.complaint.findFirst({
      where: {
        reporterId,
        adId: adId ?? null,
        userId: userId ?? null,
        status: ComplaintStatus.OPEN,
      },
    });
    if (open) {
      throw new ConflictException(
        'Вы уже пожаловались, жалоба на рассмотрении',
      );
    }

    return this.prisma.complaint.create({
      data: { reporterId, adId, userId, reason, comment },
      include: complaintInclude,
    });
  }

  // Очередь модератора: первыми — самые давние жалобы
  findOpen(): Promise<ComplaintWithRelations[]> {
    return this.prisma.complaint.findMany({
      where: { status: ComplaintStatus.OPEN },
      include: complaintInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Принятая жалоба скрывает объявление (или все объявления пользователя)
  // и закрывает остальные жалобы на него же; отклонённая закрывает только себя
  async resolve(id: number, status: ComplaintStatus): Promise<void> {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('Жалоба не найдена');
    if (complaint.status !== ComplaintStatus.OPEN) {
      throw new ConflictException('Жалоба уже рассмотрена');
    }

    const data = { status, resolvedAt: new Date() };
    if (status === ComplaintStatus.DISMISSED) {
      await this.prisma.complaint.updateMany({ where: { id }, data });
      return;
    }

    const target =
      complaint.adId !== null
        ? { adId: complaint.adId }
        : { userId: complaint.userId };
    const hidden =
      complaint.adId !== null
        ? { id: complaint.adId }
        : { authorId: complaint.userId!, status: AdStatus.PUBLISHED };
    await this.prisma.$transaction([
      this.prisma.ad.updateMany({
        where: hidden,
        data: { status: AdStatus.REJECTED },
      }),
      this.prisma.complaint.updateMany({
        where: { ...target, status: ComplaintStatus.OPEN },
        data,
      }),
    ]);
  }

  // Жаловаться можно только на то, что видно на сайте, и не на себя
  private async checkTarget(
    reporterId: number,
    adId?: number,
    userId?: number,
  ): Promise<void> {
    if (adId !== undefined) {
      const ad = await this.prisma.ad.findFirst({
        where: { id: adId, status: AdStatus.PUBLISHED },
      });
      if (!ad) throw new NotFoundException('Объявление не найдено');
      if (ad.authorId === reporterId) {
        throw new BadRequestException('Нельзя пожаловаться на своё объявление');
      }
    } else {
      if (userId === reporterId) {
        throw new BadRequestException('Нельзя пожаловаться на себя');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('Пользователь не найден');
    }
  }
}
