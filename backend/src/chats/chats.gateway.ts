import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Message } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/auth.types';
import { ChatsService, type SentMessage } from './chats.service';
import { WsSendMessageDto } from './dto/ws-send-message.dto';

// Ответ на событие message:send: сообщение или текст ошибки для пользователя
export type SendAck = { message: Message } | { error: string };

// У каждого пользователя своя комната: так сообщение дойдёт во все его вкладки
export const userRoom = (userId: number) => `user:${userId}`;

@WebSocketGateway()
export class ChatsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly chatsService: ChatsService,
  ) {}

  // Без действующего токена соединение сразу закрывается
  async handleConnection(client: Socket): Promise<void> {
    const { token } = client.handshake.auth as { token?: unknown };
    try {
      const user = await this.jwt.verifyAsync<JwtPayload>(String(token));
      client.data = { user };
      await client.join(userRoom(user.sub));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('message:send')
  async send(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<SendAck> {
    const dto = plainToInstance(WsSendMessageDto, body ?? {});
    const [problem] = await validate(dto);
    if (problem) {
      return { error: Object.values(problem.constraints ?? {})[0] };
    }
    const { user } = client.data as { user: JwtPayload };
    try {
      const sent = await this.chatsService.send(dto.chatId, user.sub, dto.text);
      this.deliver(sent);
      return { message: sent.message };
    } catch (e) {
      if (e instanceof HttpException) return { error: e.message };
      throw e;
    }
  }

  // Новое сообщение получают оба участника, в том числе другие вкладки отправителя
  deliver({ message, memberIds }: SentMessage): void {
    this.server.to(memberIds.map(userRoom)).emit('message:new', message);
  }
}
