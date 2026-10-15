import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    controller = moduleRef.get(AuthController);
  });

  it('передаёт данные регистрации и входа в сервис', async () => {
    const dto = { email: 'ivan@mail.ru', password: 'secret12', name: 'Иван' };
    await controller.register(dto);
    await controller.login(dto);
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('возвращает профиль пользователя из токена', async () => {
    await controller.me({ sub: 7, email: 'ivan@mail.ru', role: Role.USER });
    expect(authService.getProfile).toHaveBeenCalledWith(7);
  });
});

describe('JwtStrategy', () => {
  it('кладёт содержимое токена в запрос', () => {
    const config = { getOrThrow: () => 'secret' } as unknown as ConfigService;
    const payload = { sub: 1, email: 'm@board.local', role: Role.MODERATOR };
    expect(new JwtStrategy(config).validate(payload)).toBe(payload);
  });
});
