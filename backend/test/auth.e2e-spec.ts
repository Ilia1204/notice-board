import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  const user = { email: 'ivan@mail.ru', password: 'secret12', name: 'Иван' };

  it('регистрирует пользователя и возвращает токен', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(201);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String) as string,
      user: { email: 'ivan@mail.ru', role: 'USER' },
    });
  });

  it('не регистрирует повторно тот же email', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(409);
  });

  it('проверяет входные данные', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-email', password: '1', name: '' })
      .expect(400);
  });

  it('входит и получает профиль по токену', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);
    const { accessToken } = login.body as { accessToken: string };

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body).toEqual({
      id: 1,
      email: 'ivan@mail.ru',
      name: 'Иван',
      role: 'USER',
    });
  });

  it('не пускает с неверным паролем', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'wrong-password' })
      .expect(401);
  });

  it('не отдаёт профиль без токена', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});
