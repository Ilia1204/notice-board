import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, Role, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(code, {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });

describe('UsersService', () => {
  let service: UsersService;
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const createdAt = new Date('2026-11-01T10:00:00.000Z');
  const user: User = {
    id: 1,
    email: 'ivan@mail.ru',
    name: 'Иван',
    role: Role.USER,
    passwordHash: 'hash',
    createdAt,
  };
  const profile = {
    id: 1,
    email: 'ivan@mail.ru',
    name: 'Иван',
    role: Role.USER,
    createdAt,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('getProfile', () => {
    it('отдаёт профиль с датой регистрации и без хеша пароля', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.getProfile(1)).resolves.toEqual(profile);
    });

    it('отказывает, если пользователя уже нет', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile(1)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('update', () => {
    it('сохраняет имя без пробелов и email в нижнем регистре', async () => {
      prisma.user.update.mockResolvedValue(user);

      const result = await service.update(1, {
        name: ' Иван ',
        email: 'Ivan@Mail.ru',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Иван', email: 'ivan@mail.ru' },
      });
      expect(result).toEqual(profile);
    });

    it('не даёт занять чужой email', async () => {
      prisma.user.update.mockRejectedValue(knownError('P2002'));
      await expect(
        service.update(1, { name: 'Иван', email: 'petr@mail.ru' }),
      ).rejects.toThrow(ConflictException);
    });

    it('отказывает, если пользователя уже нет', async () => {
      prisma.user.update.mockRejectedValue(knownError('P2025'));
      await expect(
        service.update(1, { name: 'Иван', email: 'ivan@mail.ru' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('другие ошибки базы не скрывает', async () => {
      const failure = new Error('база недоступна');
      prisma.user.update.mockRejectedValue(failure);
      await expect(
        service.update(1, { name: 'Иван', email: 'ivan@mail.ru' }),
      ).rejects.toBe(failure);
    });
  });
});
