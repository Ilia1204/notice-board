import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaFake } from './prisma.fake';

interface AuthBody {
  accessToken: string;
}

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const server = () => request(app.getHttpServer());
  const auth = () => `Bearer ${token}`;
  const update = (body: object) =>
    server().patch('/users/me').set('Authorization', auth()).send(body);
  const register = (email: string, name: string) =>
    server()
      .post('/auth/register')
      .send({ email, name, password: 'secret12' })
      .expect(201);

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

    const res = await register('ivan@mail.ru', 'Иван');
    token = (res.body as AuthBody).accessToken;
    await register('petr@mail.ru', 'Пётр');
  });

  afterAll(async () => {
    await app.close();
  });

  it('гостю профиль недоступен', async () => {
    await server().get('/users/me').expect(401);
    await server().patch('/users/me').send({}).expect(401);
  });

  it('отдаёт свой профиль без хеша пароля', async () => {
    const res = await server()
      .get('/users/me')
      .set('Authorization', auth())
      .expect(200);
    expect(res.body).toMatchObject({
      email: 'ivan@mail.ru',
      name: 'Иван',
      role: 'USER',
    });
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('проверяет имя и email', async () => {
    await update({ name: '   ', email: 'ivan@mail.ru' }).expect(400);
    await update({ name: 'Иван', email: 'не почта' }).expect(400);
  });

  it('роль через профиль не поменять', async () => {
    const res = await update({
      name: 'Иван',
      email: 'ivan@mail.ru',
      role: 'MODERATOR',
    }).expect(200);
    expect((res.body as { role: string }).role).toBe('USER');
  });

  it('не даёт занять чужой email', async () => {
    await update({ name: 'Иван', email: 'Petr@mail.ru' }).expect(409);
  });

  it('свой email можно оставить прежним', async () => {
    const res = await update({
      name: 'Иван Петров',
      email: 'ivan@mail.ru',
    }).expect(200);
    expect((res.body as { name: string }).name).toBe('Иван Петров');
  });

  it('после смены email вход работает с новым адресом', async () => {
    await update({ name: 'Иван', email: 'New@mail.ru' }).expect(200);
    await server()
      .post('/auth/login')
      .send({ email: 'new@mail.ru', password: 'secret12' })
      .expect(200);
    await server()
      .post('/auth/login')
      .send({ email: 'ivan@mail.ru', password: 'secret12' })
      .expect(401);
  });
});
