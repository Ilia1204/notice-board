import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Socket } from 'socket.io';
import { ChatsGateway } from './chats.gateway';
import { ChatsService } from './chats.service';

describe('ChatsGateway', () => {
  let gateway: ChatsGateway;
  const jwt = { verifyAsync: jest.fn() };
  const service = { send: jest.fn() };
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const user = { sub: 5, email: 'a@b.c', role: 'USER' as const };
  const message = { id: 1, chatId: 3, senderId: 5, text: 'Привет' };

  const join = jest.fn();
  const disconnect = jest.fn();
  const socket = (token?: string) =>
    ({
      handshake: { auth: { token } },
      data: { user },
      join,
      disconnect,
    }) as unknown as Socket;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatsGateway,
        { provide: JwtService, useValue: jwt },
        { provide: ChatsService, useValue: service },
      ],
    }).compile();
    gateway = moduleRef.get(ChatsGateway);
    gateway.server = { to } as unknown as ChatsGateway['server'];
  });

  it('по токену кладёт соединение в комнату пользователя', async () => {
    jwt.verifyAsync.mockResolvedValue(user);
    await gateway.handleConnection(socket('tok'));
    expect(jwt.verifyAsync).toHaveBeenCalledWith('tok');
    expect(join).toHaveBeenCalledWith('user:5');
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('без действующего токена закрывает соединение', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await gateway.handleConnection(socket());
    expect(join).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('сохраняет сообщение и доставляет его обоим участникам', async () => {
    service.send.mockResolvedValue({ message, memberIds: [5, 9] });
    await expect(
      gateway.send(socket(), { chatId: 3, text: '  Привет ' }),
    ).resolves.toEqual({ message });
    expect(service.send).toHaveBeenCalledWith(3, 5, 'Привет');
    expect(to).toHaveBeenCalledWith(['user:5', 'user:9']);
    expect(emit).toHaveBeenCalledWith('message:new', message);
  });

  it('пустое сообщение не отправляет', async () => {
    await expect(
      gateway.send(socket(), { chatId: 3, text: '   ' }),
    ).resolves.toEqual({ error: 'Сообщение не может быть пустым' });
    await expect(gateway.send(socket(), { text: 'Привет' })).resolves.toEqual({
      error: 'Не указан диалог',
    });
    expect(service.send).not.toHaveBeenCalled();
  });

  it('ошибку доступа возвращает текстом', async () => {
    service.send.mockRejectedValue(new ForbiddenException('Это чужой диалог'));
    await expect(
      gateway.send(socket(), { chatId: 3, text: 'Привет' }),
    ).resolves.toEqual({ error: 'Это чужой диалог' });
    expect(emit).not.toHaveBeenCalled();
  });
});
