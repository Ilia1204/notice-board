import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

interface MessageBody {
  id: number;
  chatId: number;
  senderId: number;
  text: string;
}
type Ack = { message: MessageBody } | { error: string };

describe('Chats realtime (e2e)', () => {
  let app: INestApplication<App>;
  let url: string;
  let chatId: number;
  // Продавец Анна, покупатель Иван и посторонний Пётр
  let sellerToken: string;
  let buyerToken: string;
  let otherToken: string;
  const sockets: Socket[] = [];

  const server = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const register = async (email: string, name: string) => {
    const res = await server()
      .post('/auth/register')
      .send({ email, name, password: 'secret123' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  };

  const socketFor = (token: string) => {
    const socket = io(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  };
  // Подключение считается готовым, когда сервер принял токен
  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = socketFor(token);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  const nextMessage = (socket: Socket) =>
    new Promise<MessageBody>((resolve) => socket.once('message:new', resolve));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(createPrismaFake())
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0);
    url = await app.getUrl();

    const moderatorToken = await app.get(JwtService).signAsync({
      sub: 100,
      email: 'moderator@board.local',
      role: 'MODERATOR',
    });
    sellerToken = await register('anna@mail.ru', 'Анна');
    buyerToken = await register('ivan@mail.ru', 'Иван');
    otherToken = await register('petr@mail.ru', 'Пётр');

    await server()
      .post('/categories')
      .set('Authorization', auth(moderatorToken))
      .send({ name: 'Транспорт' })
      .expect(201);
    const ad = await server()
      .post('/ads')
      .set('Authorization', auth(sellerToken))
      .send({
        title: 'Велосипед',
        description: 'Горный, 21 скорость',
        categoryId: 1,
      })
      .expect(201);
    const adId = (ad.body as { id: number }).id;
    await server()
      .patch(`/ads/${adId}/status`)
      .set('Authorization', auth(moderatorToken))
      .send({ status: 'PUBLISHED' })
      .expect(200);
    const chat = await server()
      .post('/chats')
      .set('Authorization', auth(buyerToken))
      .send({ adId })
      .expect(201);
    chatId = (chat.body as { id: number }).id;
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  it('без токена соединение закрывается', async () => {
    const socket = socketFor('плохой токен');
    await new Promise((resolve) => socket.once('disconnect', resolve));
    expect(socket.connected).toBe(false);
  });

  it('сообщение покупателя сразу приходит продавцу', async () => {
    const buyer = await connect(buyerToken);
    const seller = await connect(sellerToken);
    const received = nextMessage(seller);

    const ack = (await buyer.emitWithAck('message:send', {
      chatId,
      text: '  Ещё продаёте?  ',
    })) as Ack;

    expect(ack).toMatchObject({ message: { text: 'Ещё продаёте?' } });
    await expect(received).resolves.toMatchObject({
      chatId,
      text: 'Ещё продаёте?',
    });
  });

  it('ответ через REST тоже доставляется без перезагрузки', async () => {
    const buyer = await connect(buyerToken);
    const received = nextMessage(buyer);
    await server()
      .post(`/chats/${chatId}/messages`)
      .set('Authorization', auth(sellerToken))
      .send({ text: 'Да, продаю' })
      .expect(201);
    await expect(received).resolves.toMatchObject({ text: 'Да, продаю' });
  });

  it('посторонний не пишет в чужой диалог и не видит переписку', async () => {
    const other = await connect(otherToken);
    const buyer = await connect(buyerToken);
    const leaked = jest.fn();
    other.on('message:new', leaked);

    await expect(
      other.emitWithAck('message:send', { chatId, text: 'Привет' }),
    ).resolves.toEqual({ error: 'Это чужой диалог' });
    await expect(
      buyer.emitWithAck('message:send', { chatId, text: '   ' }),
    ).resolves.toEqual({ error: 'Сообщение не может быть пустым' });

    const received = nextMessage(buyer);
    await buyer.emitWithAck('message:send', { chatId, text: 'Когда удобно?' });
    await received;
    expect(leaked).not.toHaveBeenCalled();

    const history = await server()
      .get(`/chats/${chatId}/messages`)
      .set('Authorization', auth(sellerToken))
      .expect(200);
    expect((history.body as MessageBody[]).map((m) => m.text)).toEqual([
      'Ещё продаёте?',
      'Да, продаю',
      'Когда удобно?',
    ]);
  });
});
