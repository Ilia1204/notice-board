import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Ad } from '@prisma/client';
import type { Server } from 'socket.io';
import { userRoom } from '../common/user-room';

// Что узнаёт автор о решении модератора
export type AdModeratedEvent = Pick<
  Ad,
  'id' | 'title' | 'status' | 'rejectReason'
>;

// Сообщает автору о решении модератора через то же соединение, что и чат.
// Вход по токену и комнаты пользователей настраивает ChatsGateway
@WebSocketGateway()
export class AdsGateway {
  @WebSocketServer()
  server!: Server;

  notifyModerated({ id, title, status, rejectReason, authorId }: Ad): void {
    const event: AdModeratedEvent = { id, title, status, rejectReason };
    this.server.to(userRoom(authorId)).emit('ad:moderated', event);
  }
}
