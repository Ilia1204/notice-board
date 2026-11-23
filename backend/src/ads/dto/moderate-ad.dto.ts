import { AdStatus } from '@prisma/client';
import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/trim.decorator';

export class ModerateAdDto {
  // Вернуть на проверку нельзя: это делает только правка автора
  @IsIn([AdStatus.PUBLISHED, AdStatus.REJECTED], {
    message: 'Выберите решение модератора',
  })
  status!: AdStatus;

  // Отклоняя, модератор объясняет автору, что исправить
  @ValidateIf((dto: ModerateAdDto) => dto.status === AdStatus.REJECTED)
  @Trim()
  @IsString({ message: 'Укажите причину отклонения' })
  @MinLength(1, { message: 'Укажите причину отклонения' })
  @MaxLength(300, {
    message: 'Причина должна быть не длиннее 300 символов',
  })
  reason?: string;
}
