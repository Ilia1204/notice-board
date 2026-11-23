import type { Ad } from '@prisma/client';
import { AdsGateway } from './ads.gateway';

describe('AdsGateway', () => {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const gateway = new AdsGateway();
  gateway.server = { to } as unknown as AdsGateway['server'];

  it('сообщает автору решение модератора и причину', () => {
    gateway.notifyModerated({
      id: 3,
      title: 'Велосипед',
      description: 'Горный',
      status: 'REJECTED',
      rejectReason: 'Нет фото',
      authorId: 7,
    } as Ad);
    expect(to).toHaveBeenCalledWith('user:7');
    expect(emit).toHaveBeenCalledWith('ad:moderated', {
      id: 3,
      title: 'Велосипед',
      status: 'REJECTED',
      rejectReason: 'Нет фото',
    });
  });
});
