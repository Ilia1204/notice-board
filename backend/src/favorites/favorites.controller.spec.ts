import { Test } from '@nestjs/testing';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  const service = {
    findAll: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
  };
  const user = { sub: 5, email: 'a@b.c', role: 'USER' as const };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [{ provide: FavoritesService, useValue: service }],
    }).compile();
    controller = moduleRef.get(FavoritesController);
  });

  it('берёт пользователя из токена', async () => {
    await controller.findAll(user);
    await controller.add(user, 7);
    await controller.remove(user, 7);
    expect(service.findAll).toHaveBeenCalledWith(5);
    expect(service.add).toHaveBeenCalledWith(5, 7);
    expect(service.remove).toHaveBeenCalledWith(5, 7);
  });
});
