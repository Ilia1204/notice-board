import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

interface ComplaintBody {
  id: number;
  reason: string;
  comment: string | null;
  reporter: { name: string };
  ad: { id: number; title: string } | null;
  user: { id: number; name: string } | null;
}

describe('Complaints (e2e)', () => {
  let app: INestApplication<App>;
  let moderatorToken: string;
  // Продавец Анна, покупатели Иван и Пётр
  let sellerToken: string;
  let buyerToken: string;
  let otherToken: string;
  let sellerId: number;

  const server = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const register = async (email: string, name: string) => {
    const res = await server()
      .post('/auth/register')
      .send({ email, name, password: 'secret123' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  };
  const complain = (body: object, token = buyerToken) =>
    server().post('/complaints').set('Authorization', auth(token)).send(body);
  const queue = async () => {
    const res = await server()
      .get('/complaints')
      .set('Authorization', auth(moderatorToken))
      .expect(200);
    return res.body as ComplaintBody[];
  };
  const resolve = (id: number, status: string, token = moderatorToken) =>
    server()
      .patch(`/complaints/${id}`)
      .set('Authorization', auth(token))
      .send({ status });
  const adStatus = async (id: number) => {
    const res = await server()
      .get(`/ads/mine/${id}`)
      .set('Authorization', auth(sellerToken))
      .expect(200);
    return (res.body as { status: string }).status;
  };

  async function createAd(title: string, status = 'PUBLISHED') {
    const res = await server()
      .post('/ads')
      .set('Authorization', auth(sellerToken))
      .send({ title, description: 'Описание объявления', categoryId: 1 })
      .expect(201);
    const { id } = res.body as { id: number };
    if (status !== 'PENDING') {
      await server()
        .patch(`/ads/${id}/status`)
        .set('Authorization', auth(moderatorToken))
        .send({ status })
        .expect(200);
    }
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
    sellerId = 1;

    await server()
      .post('/categories')
      .set('Authorization', auth(moderatorToken))
      .send({ name: 'Транспорт' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('гость не может жаловаться, а обычный пользователь — разбирать жалобы', async () => {
    await server().post('/complaints').send({ adId: 1 }).expect(401);
    await server().get('/complaints').expect(401);
    await server()
      .get('/complaints')
      .set('Authorization', auth(buyerToken))
      .expect(403);
    await resolve(1, 'ACCEPTED', buyerToken).expect(403);
  });

  it('жалоба на объявление попадает к модератору', async () => {
    const adId = await createAd('Велосипед');
    const res = await complain({
      adId,
      reason: 'FRAUD',
      comment: '  Просит предоплату  ',
    }).expect(201);
    expect((res.body as ComplaintBody).comment).toBe('Просит предоплату');

    const [complaint] = await queue();
    expect(complaint.reporter.name).toBe('Иван');
    expect(complaint.ad?.title).toBe('Велосипед');
    expect(complaint.reason).toBe('FRAUD');
  });

  it('повторную жалобу до решения не принимает, от другого человека — принимает', async () => {
    const [first] = await queue();
    await complain({ adId: first.ad!.id, reason: 'SPAM' }).expect(409);
    await complain({ adId: first.ad!.id, reason: 'SPAM' }, otherToken).expect(
      201,
    );
    expect(await queue()).toHaveLength(2);
  });

  it('принятая жалоба скрывает объявление и закрывает все жалобы на него', async () => {
    const [first] = await queue();
    await resolve(first.id, 'ACCEPTED').expect(204);
    expect(await adStatus(first.ad!.id)).toBe('REJECTED');
    expect(await queue()).toEqual([]);
    await server().get(`/ads/${first.ad!.id}`).expect(404);
    await resolve(first.id, 'DISMISSED').expect(409);
  });

  it('отклонённая жалоба оставляет объявление на сайте', async () => {
    const adId = await createAd('Самокат');
    await complain({ adId, reason: 'PROHIBITED' }).expect(201);
    const [complaint] = await queue();
    await resolve(complaint.id, 'DISMISSED').expect(204);
    expect(await adStatus(adId)).toBe('PUBLISHED');
    expect(await queue()).toEqual([]);
  });

  it('жалоба на пользователя скрывает все его опубликованные объявления', async () => {
    const shown = await createAd('Ролики');
    const pending = await createAd('Лыжи', 'PENDING');
    await complain({ userId: sellerId, reason: 'OFFENSIVE' }).expect(201);
    const [complaint] = await queue();
    expect(complaint.user?.name).toBe('Анна');
    expect(complaint.ad).toBeNull();

    await resolve(complaint.id, 'ACCEPTED').expect(204);
    expect(await adStatus(shown)).toBe('REJECTED');
    expect(await adStatus(pending)).toBe('PENDING');
  });

  it('проверяет цель, причину и комментарий', async () => {
    const adId = await createAd('Гитара');
    await complain({ reason: 'SPAM' }).expect(400);
    await complain({ adId, userId: sellerId, reason: 'SPAM' }).expect(400);
    await complain({ adId, reason: 'LOL' }).expect(400);
    await complain({ adId, reason: 'OTHER', comment: '   ' }).expect(400);
    await complain({ adId, reason: 'SPAM', comment: 'а'.repeat(1001) }).expect(
      400,
    );
    await complain({ adId, reason: 'SPAM' }, sellerToken).expect(400);
    await complain({ userId: sellerId, reason: 'SPAM' }, sellerToken).expect(
      400,
    );
    await complain({
      adId: await createAd('Коньки', 'REJECTED'),
      reason: 'SPAM',
    }).expect(404);
    await complain({ userId: 999, reason: 'SPAM' }).expect(404);
    await resolve(999, 'ACCEPTED').expect(404);
    await resolve(1, 'OPEN').expect(400);
  });
});
