import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

interface ChatBody {
  id: number;
  ad: { id: number; title: string };
  companion: { id: number; name: string };
  lastMessage: { text: string } | null;
}

describe('Chats (e2e)', () => {
  let app: INestApplication<App>;
  let moderatorToken: string;
  // Продавец Анна, покупатели Иван и Пётр
  let sellerToken: string;
  let buyerToken: string;
  let otherToken: string;

  const server = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const register = async (email: string, name: string) => {
    const res = await server()
      .post('/auth/register')
      .send({ email, name, password: 'secret123' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  };
  const open = (adId: unknown, token = buyerToken) =>
    server().post('/chats').set('Authorization', auth(token)).send({ adId });
  const send = (chatId: number, text: string, token = buyerToken) =>
    server()
      .post(`/chats/${chatId}/messages`)
      .set('Authorization', auth(token))
      .send({ text });
  const list = async (token: string) => {
    const res = await server()
      .get('/chats')
      .set('Authorization', auth(token))
      .expect(200);
    return res.body as ChatBody[];
  };

  async function createAd(title: string, status = 'PUBLISHED') {
    const res = await server()
      .post('/ads')
      .set('Authorization', auth(sellerToken))
      .send({ title, description: 'Описание объявления', categoryId: 1 })
      .expect(201);
    const { id } = res.body as { id: number };
    await server()
      .patch(`/ads/${id}/status`)
      .set('Authorization', auth(moderatorToken))
      .send({ status })
      .expect(200);
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(createPrismaFake())
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    moderatorToken = await app.get(JwtService).signAsync({
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('гостю переписка недоступна', async () => {
    await server().get('/chats').expect(401);
    await server().post('/chats').send({ adId: 1 }).expect(401);
    await server().get('/chats/1/messages').expect(401);
    await server().post('/chats/1/messages').send({ text: 'Hi' }).expect(401);
  });

  it('покупатель пишет автору, история сохраняется', async () => {
    const adId = await createAd('Велосипед');
    const opened = await open(adId).expect(201);
    const chat = opened.body as ChatBody;
    expect(chat.companion.name).toBe('Анна');
    expect(chat.lastMessage).toBeNull();

    await send(chat.id, '  Здравствуйте, ещё продаёте?  ').expect(201);
    await send(chat.id, 'Да, продаю', sellerToken).expect(201);

    const res = await server()
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', auth(sellerToken))
      .expect(200);
    expect(
      (res.body as { text: string }[]).map((message) => message.text),
    ).toEqual(['Здравствуйте, ещё продаёте?', 'Да, продаю']);
  });

  it('у каждой стороны в списке свой собеседник и последнее сообщение', async () => {
    const [forBuyer] = await list(buyerToken);
    expect(forBuyer.companion.name).toBe('Анна');
    expect(forBuyer.ad.title).toBe('Велосипед');
    expect(forBuyer.lastMessage?.text).toBe('Да, продаю');

    const [forSeller] = await list(sellerToken);
    expect(forSeller.companion.name).toBe('Иван');
    expect(await list(otherToken)).toEqual([]);
  });

  it('повторное открытие возвращает тот же диалог, пустой не виден в списке', async () => {
    const adId = await createAd('Самокат');
    const first = (await open(adId).expect(201)).body as ChatBody;
    const second = (await open(adId).expect(201)).body as ChatBody;
    expect(second.id).toBe(first.id);
    expect((await list(buyerToken)).map((chat) => chat.id)).not.toContain(
      first.id,
    );
  });

  it('диалог с новым сообщением поднимается наверх', async () => {
    const [older] = await list(buyerToken);
    const adId = await createAd('Ролики');
    const newer = (await open(adId).expect(201)).body as ChatBody;
    await send(newer.id, 'Какой размер?').expect(201);
    expect((await list(buyerToken))[0].id).toBe(newer.id);

    await send(older.id, 'Можно посмотреть завтра?').expect(201);
    expect((await list(buyerToken))[0].id).toBe(older.id);
  });

  it('чужой диалог не открыть и туда не написать', async () => {
    const [chat] = await list(buyerToken);
    await server()
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', auth(otherToken))
      .expect(403);
    await server()
      .get(`/chats/${chat.id}`)
      .set('Authorization', auth(otherToken))
      .expect(403);
    await send(chat.id, 'Привет', otherToken).expect(403);
    await send(999, 'Привет').expect(404);
  });

  it('проверяет объявление и текст сообщения', async () => {
    const own = await createAd('Лыжи');
    await open(own, sellerToken).expect(400);
    await open(await createAd('Коньки', 'REJECTED')).expect(404);
    await open(999).expect(404);
    await open('abc').expect(400);

    const [chat] = await list(buyerToken);
    await send(chat.id, '   ').expect(400);
    await send(chat.id, 'а'.repeat(2001)).expect(400);
  });
});
