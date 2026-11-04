import { AdStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class ModerateAdDto {
  // Вернуть на проверку нельзя: это делает только правка автора
  @IsIn([AdStatus.PUBLISHED, AdStatus.REJECTED], {
    message: 'Выберите решение модератора',
  })
  status!: AdStatus;
}
