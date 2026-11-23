import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ModerateAdDto } from './moderate-ad.dto';

const errors = async (body: object) => {
  const problems = await validate(plainToInstance(ModerateAdDto, body));
  return problems.flatMap((p) => Object.values(p.constraints ?? {}));
};

describe('ModerateAdDto', () => {
  it('публикация обходится без причины', async () => {
    expect(await errors({ status: 'PUBLISHED' })).toEqual([]);
  });

  it.each([{}, { reason: '   ' }, { reason: 5 }])(
    'без причины не отклоняет: %j',
    async (extra) => {
      expect(await errors({ status: 'REJECTED', ...extra })).toContain(
        'Укажите причину отклонения',
      );
    },
  );

  it('принимает причину и обрезает пробелы', async () => {
    const dto = plainToInstance(ModerateAdDto, {
      status: 'REJECTED',
      reason: '  Нет фото ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.reason).toBe('Нет фото');
  });

  it('не принимает слишком длинную причину', async () => {
    expect(
      await errors({ status: 'REJECTED', reason: 'а'.repeat(301) }),
    ).toEqual(['Причина должна быть не длиннее 300 символов']);
  });
});
