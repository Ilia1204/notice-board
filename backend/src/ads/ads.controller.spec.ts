import { Test } from '@nestjs/testing';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

describe('AdsController', () => {
  let controller: AdsController;
  const service = { create: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdsController],
      providers: [{ provide: AdsService, useValue: service }],
    }).compile();
    controller = moduleRef.get(AdsController);
  });

  it('публикует объявление от текущего пользователя', async () => {
    const dto = { title: 'Велосипед', description: 'Горный', categoryId: 1 };
    await controller.create({ sub: 5, email: 'a@b.c', role: 'USER' }, dto, []);
    expect(service.create).toHaveBeenCalledWith(5, dto, []);
  });
});
