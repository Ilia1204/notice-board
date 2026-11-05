import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

describe('Favorites (e2e)', () => {
  let app: INestApplication<App>;
  let moderatorToken: string;
  let userToken: string;
  let otherToken: string;

  const server = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const favoriteIds = async (token: string) => {
    const res = await server()
      .get('/favorites')
      .set('Authorization', auth(token))
      .expect(200);
    return (res.body as { id: number }[]).map((ad) => ad.id);
  };
  const add = (id: number | string, token = userToken) =>
    server().put(`/favorites/${id}`).set('Authorization', auth(token));
  const remove = (id: number, token = userToken) =>
    server().delete(`/favorites/${id}`).set('Authorization', auth(token));
  const moderate = (id: number, status: string) =>
    server()
      .patch(`/ads/${id}/status`)
      .set('Authorization', auth(moderatorToken))
      .send({ status })
      .expect(200);

  async function createAd(title: string) {
    const res = await server()
      .post('/ads')
      .set('Authorization', auth(otherToken))
      .send({ title, description: 'Описание объявления', categoryId: 1 })
      .expect(201);
    return (res.body as { id: number }).id;
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

    const jwt = app.get(JwtService);
    moderatorToken = await jwt.signAsync({
      sub: 1,
      email: 'moderator@board.local',
      role: 'MODERATOR',
    });
    userToken = await jwt.signAsync({
      sub: 2,
      email: 'ivan@mail.ru',
      role: 'USER',
    });
    otherToken = await jwt.signAsync({
      sub: 3,
      email: 'petr@mail.ru',
      role: 'USER',
    });

    await server()
      .post('/categories')
      .set('Authorization', auth(moderatorToken))
      .send({ name: 'Транспорт' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('гостю избранное недоступно', async () => {
    await server().get('/favorites').expect(401);
    await server().put('/favorites/1').expect(401);
    await server().delete('/favorites/1').expect(401);
  });

  it('добавляет объявления, свежие сверху и без дублей', async () => {
    const first = await createAd('Велосипед');
    const second = await createAd('Самокат');
    await moderate(first, 'PUBLISHED');
    await moderate(second, 'PUBLISHED');

    await add(first).expect(204);
    await add(second).expect(204);
    await add(first).expect(204);
    expect(await favoriteIds(userToken)).toEqual([second, first]);
  });

  it('у каждого пользователя своё избранное', async () => {
    expect(await favoriteIds(otherToken)).toEqual([]);
  });

  it('убирает объявление, повторное удаление не ошибка', async () => {
    const id = await createAd('Ролики');
    await moderate(id, 'PUBLISHED');
    await add(id).expect(204);

    await remove(id).expect(204);
    await remove(id).expect(204);
    expect(await favoriteIds(userToken)).not.toContain(id);
  });

  it('не добавляет неопубликованное и несуществующее объявление', async () => {
    const id = await createAd('Лыжи');
    await add(id).expect(404);
    await add(999).expect(404);
    await add('abc').expect(400);
  });

  it('скрытое объявление пропадает и возвращается после публикации', async () => {
    const id = await createAd('Коньки');
    await moderate(id, 'PUBLISHED');
    await add(id).expect(204);

    await moderate(id, 'REJECTED');
    expect(await favoriteIds(userToken)).not.toContain(id);

    await moderate(id, 'PUBLISHED');
    expect(await favoriteIds(userToken)).toContain(id);
  });
});
