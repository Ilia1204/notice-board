import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdsService } from '../ads/ads.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { complaintInclude, ComplaintsService } from './complaints.service';

describe('ComplaintsService', () => {
  let service: ComplaintsService;
  const hideQuery = Promise.resolve({ count: 1 });
  const ads = {
    findPublishedOne: jest.fn(),
    hideByComplaint: jest.fn(() => hideQuery),
  };
  const users = { ensureExists: jest.fn() };
  const prisma = {
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
    ads.findPublishedOne.mockResolvedValue({ id: 7, authorId: 9 });
    users.ensureExists.mockResolvedValue(undefined);
    prisma.complaint.findFirst.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AdsService, useValue: ads },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = moduleRef.get(ComplaintsService);
  });

  describe('create', () => {
    it('сохраняет жалобу на опубликованное объявление', async () => {
      await service.create(5, { adId: 7, reason: 'FRAUD', comment: '' });
      expect(ads.findPublishedOne).toHaveBeenCalledWith(7);
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
      expect(users.ensureExists).toHaveBeenCalledWith(9);
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
      ads.findPublishedOne.mockRejectedValue(
        new NotFoundException('Объявление не найдено'),
      );
      users.ensureExists.mockRejectedValue(
        new NotFoundException('Пользователь не найден'),
      );
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
      // Объявление скрывает AdsService, в одной транзакции с жалобами
      expect(ads.hideByComplaint).toHaveBeenCalledWith({ adId: 7 });
      expect(prisma.$transaction).toHaveBeenCalledWith([hideQuery, undefined]);
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
      expect(ads.hideByComplaint).toHaveBeenCalledWith({ authorId: 9 });
      expect(prisma.complaint.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 9, status: 'OPEN' } }),
      );
    });

    it('отклонённая жалоба ничего не скрывает', async () => {
      prisma.complaint.findUnique.mockResolvedValue(open);
      await service.resolve(3, 'DISMISSED');
      expect(ads.hideByComplaint).not.toHaveBeenCalled();
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
