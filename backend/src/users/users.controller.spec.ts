import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const service = { getProfile: jest.fn(), update: jest.fn() };
  const user = { sub: 5, email: 'a@b.c', role: 'USER' as const };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();
    controller = moduleRef.get(UsersController);
  });

  it('берёт пользователя из токена', async () => {
    const dto = { name: 'Иван', email: 'ivan@mail.ru' };
    await controller.me(user);
    await controller.update(user, dto);
    expect(service.getProfile).toHaveBeenCalledWith(5);
    expect(service.update).toHaveBeenCalledWith(5, dto);
  });
});
