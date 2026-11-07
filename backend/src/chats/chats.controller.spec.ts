import { Test } from '@nestjs/testing';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

describe('ChatsController', () => {
  let controller: ChatsController;
  const service = {
    findAll: jest.fn(),
    open: jest.fn(),
    findOne: jest.fn(),
    findMessages: jest.fn(),
    send: jest.fn(),
  };
  const user = { sub: 5, email: 'a@b.c', role: 'USER' as const };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatsController],
      providers: [{ provide: ChatsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(ChatsController);
  });

  it('берёт пользователя из токена', async () => {
    await controller.findAll(user);
    await controller.open(user, { adId: 7 });
    await controller.findOne(user, 3);
    await controller.findMessages(user, 3);
    await controller.send(user, 3, { text: 'Привет' });
    expect(service.findAll).toHaveBeenCalledWith(5);
    expect(service.open).toHaveBeenCalledWith(5, 7);
    expect(service.findOne).toHaveBeenCalledWith(3, 5);
    expect(service.findMessages).toHaveBeenCalledWith(3, 5);
    expect(service.send).toHaveBeenCalledWith(3, 5, 'Привет');
  });
});
