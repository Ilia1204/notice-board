import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role, type User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token') };

  const makeUser = async (password: string): Promise<User> => ({
    id: 1,
    email: 'ivan@mail.ru',
    name: 'Иван',
    role: Role.USER,
    passwordHash: await argon2.hash(password),
    createdAt: new Date(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('создаёт пользователя с хешем пароля и возвращает токен', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: User }) => ({
        ...data,
        id: 1,
        role: Role.USER,
        createdAt: new Date(),
      }));

      const result = await service.register({
        email: 'Ivan@Mail.ru',
        password: 'secret12',
        name: ' Иван ',
      });

      const [[{ data }]] = prisma.user.create.mock.calls as [[{ data: User }]];
      expect(data.email).toBe('ivan@mail.ru');
      expect(data.name).toBe('Иван');
      expect(data.passwordHash).not.toBe('secret12');
      expect(await argon2.verify(data.passwordHash, 'secret12')).toBe(true);
      expect(result).toEqual({
        accessToken: 'token',
        user: { id: 1, email: 'ivan@mail.ru', name: 'Иван', role: Role.USER },
      });
    });

    it('отклоняет занятый email', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser('secret12'));
      await expect(
        service.register({
          email: 'ivan@mail.ru',
          password: 'secret12',
          name: 'Иван',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('выдаёт токен с id и ролью пользователя', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser('secret12'));
      const result = await service.login({
        email: 'ivan@mail.ru',
        password: 'secret12',
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 1,
        email: 'ivan@mail.ru',
        role: Role.USER,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('отклоняет неверный пароль', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser('secret12'));
      await expect(
        service.login({ email: 'ivan@mail.ru', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('отклоняет несуществующего пользователя', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@mail.ru', password: 'secret12' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('возвращает профиль без хеша пароля', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser('secret12'));
      await expect(service.getProfile(1)).resolves.toEqual({
        id: 1,
        email: 'ivan@mail.ru',
        name: 'Иван',
        role: Role.USER,
      });
    });

    it('отклоняет удалённого пользователя', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile(99)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
