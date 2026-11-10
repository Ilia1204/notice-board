import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { complaintInclude, ComplaintsService } from './complaints.service';

describe('ComplaintsService', () => {
  let service: ComplaintsService;
  const prisma = {
    ad: { findFirst: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn() },
    complaint: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  // Покупатель 5 жалуется на объявление 7 продавца 9
  const open = {
    id: 3,
    reporterId: 5,
    adId: 7,
    userId: null,
    status: 'OPEN',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.ad.findFirst.mockResolvedValue({ id: 7, authorId: 9 });
    prisma.user.findUnique.mockResolvedValue({ id: 9 });
    prisma.complaint.findFirst.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ComplaintsService);
  });

  describe('create', () => {
    it('сохраняет жалобу на опубликованное объявление', async () => {
      await service.create(5, { adId: 7, reason: 'FRAUD', comment: '' });
      expect(prisma.ad.findFirst).toHaveBeenCalledWith({
        where: { id: 7, status: 'PUBLISHED' },
      });
      expect(prisma.complaint.create).toHaveBeenCalledWith({
        data: {
          reporterId: 5,
          adId: 7,
          userId: undefined,
          reason: 'FRAUD',
          comment: null,
        },
        include: complaintInclude,
      });
    });

    it('сохраняет жалобу на пользователя', async () => {
      await service.create(5, { userId: 9, reason: 'OFFENSIVE' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 9 },
      });
      expect(prisma.complaint.create).toHaveBeenCalled();
    });

    it('требует ровно одну цель жалобы', async () => {
      await expect(service.create(5, { reason: 'SPAM' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.create(5, { adId: 7, userId: 9, reason: 'SPAM' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.complaint.create).not.toHaveBeenCalled();
    });

    it('для причины «Другое» нужен комментарий', async () => {
      await expect(
        service.create(5, { adId: 7, reason: 'OTHER' }),
      ).rejects.toThrow('Опишите, что не так');
    });

    it('не принимает жалобу на себя и своё объявление', async () => {
      await expect(
        service.create(9, { adId: 7, reason: 'SPAM' }),
      ).rejects.toThrow('Нельзя пожаловаться на своё объявление');
      await expect(
        service.create(9, { userId: 9, reason: 'SPAM' }),
      ).rejects.toThrow('Нельзя пожаловаться на себя');
    });

    it('не находит скрытое объявление или пользователя', async () => {
      prisma.ad.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create(5, { adId: 7, reason: 'SPAM' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.create(5, { userId: 9, reason: 'SPAM' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('не принимает повторную жалобу, пока первая не рассмотрена', async () => {
      prisma.complaint.findFirst.mockResolvedValue(open);
      await expect(
        service.create(5, { adId: 7, reason: 'SPAM' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.complaint.findFirst).toHaveBeenCalledWith({
        where: { reporterId: 5, adId: 7, userId: null, status: 'OPEN' },
      });
    });
  });

  it('модератору отдаёт открытые жалобы, давние сверху', async () => {
    await service.findOpen();
    expect(prisma.complaint.findMany).toHaveBeenCalledWith({
      where: { status: 'OPEN' },
      include: complaintInclude,
      orderBy: { createdAt: 'asc' },
    });
  });

  describe('resolve', () => {
    it('принятая жалоба скрывает объявление и закрывает жалобы на него', async () => {
      prisma.complaint.findUnique.mockResolvedValue(open);
      await service.resolve(3, 'ACCEPTED');
      expect(prisma.ad.updateMany).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { status: 'REJECTED' },
      });
      expect(prisma.complaint.updateMany).toHaveBeenCalledWith({
        where: { adId: 7, status: 'OPEN' },
        data: { status: 'ACCEPTED', resolvedAt: expect.any(Date) as Date },
      });
    });

    it('принятая жалоба на пользователя скрывает все его объявления', async () => {
      prisma.complaint.findUnique.mockResolvedValue({
        ...open,
        adId: null,
        userId: 9,
      });
      await service.resolve(3, 'ACCEPTED');
      expect(prisma.ad.updateMany).toHaveBeenCalledWith({
        where: { authorId: 9, status: 'PUBLISHED' },
        data: { status: 'REJECTED' },
      });
      expect(prisma.complaint.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 9, status: 'OPEN' } }),
      );
    });

    it('отклонённая жалоба ничего не скрывает', async () => {
      prisma.complaint.findUnique.mockResolvedValue(open);
      await service.resolve(3, 'DISMISSED');
      expect(prisma.ad.updateMany).not.toHaveBeenCalled();
      expect(prisma.complaint.updateMany).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { status: 'DISMISSED', resolvedAt: expect.any(Date) as Date },
      });
    });

    it('не находит жалобу и не рассматривает её дважды', async () => {
      prisma.complaint.findUnique.mockResolvedValue(null);
      await expect(service.resolve(3, 'ACCEPTED')).rejects.toThrow(
        NotFoundException,
      );
      prisma.complaint.findUnique.mockResolvedValue({
        ...open,
        status: 'DISMISSED',
      });
      await expect(service.resolve(3, 'ACCEPTED')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.complaint.updateMany).not.toHaveBeenCalled();
    });
  });
});
