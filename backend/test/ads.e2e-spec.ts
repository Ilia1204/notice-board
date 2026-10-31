import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

describe('Ads (e2e)', () => {
  let app: INestApplication<App>;
  let moderatorToken: string;
  let userToken: string;

  beforeAll(async () => {
    const prisma = createPrismaFake();
    prisma.users.push({
      id: 2,
      email: 'ivan@mail.ru',
      name: 'Иван',
      passwordHash: 'hash',
      role: 'USER',
      createdAt: new Date(),
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .send({ name: 'Транспорт' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const bike = {
    title: 'Велосипед',
    description: 'Горный, 21 скорость, почти новый',
    price: 15000,
    categoryId: 1,
  };

  it('гость не может опубликовать объявление', () => {
    return server().post('/ads').send(bike).expect(401);
  });

  it('пользователь публикует объявление', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send(bike)
      .expect(201);
    expect(res.body).toMatchObject({
      id: 1,
      title: 'Велосипед',
      price: 15000,
      category: { id: 1, name: 'Транспорт' },
      author: { id: 2, name: 'Иван' },
    });
    expect(res.body).not.toHaveProperty('author.email');
  });

  it('проверяет поля объявления', async () => {
    const res = await server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Ве', description: 'Коротко', price: -5 })
      .expect(400);
    expect((res.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([
        'Заголовок должен быть не короче 3 символов',
        'Цена не может быть отрицательной',
        'Выберите категорию',
      ]),
    );
  });

  it('отклоняет несуществующую категорию', () => {
    return server()
      .post('/ads')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ...bike, categoryId: 99 })
      .expect(400);
  });

  it('не даёт удалить категорию с объявлениями', async () => {
    const res = await server()
      .delete('/categories/1')
      .set('Authorization', `Bearer ${moderatorToken}`)
      .expect(409);
    expect(res.body).toMatchObject({ message: 'В категории есть объявления' });
  });
});
