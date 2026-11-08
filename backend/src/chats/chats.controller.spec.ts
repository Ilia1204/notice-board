import { Test } from '@nestjs/testing';
import { ChatsController } from './chats.controller';
import { ChatsGateway } from './chats.gateway';
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
  const gateway = { deliver: jest.fn() };
  const user = { sub: 5, email: 'a@b.c', role: 'USER' as const };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatsController],
      providers: [
        { provide: ChatsService, useValue: service },
        { provide: ChatsGateway, useValue: gateway },
      ],
    }).compile();
    controller = moduleRef.get(ChatsController);
  });

  it('берёт пользователя из токена', async () => {
    service.send.mockResolvedValue({ message: {}, memberIds: [5, 9] });
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

  it('сообщение через REST тоже доставляется по WebSocket', async () => {
    const sent = { message: { id: 1, text: 'Привет' }, memberIds: [5, 9] };
    service.send.mockResolvedValue(sent);
    await expect(controller.send(user, 3, { text: 'Привет' })).resolves.toBe(
      sent.message,
    );
    expect(gateway.deliver).toHaveBeenCalledWith(sent);
  });
});
