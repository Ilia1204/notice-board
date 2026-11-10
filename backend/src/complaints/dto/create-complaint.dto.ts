import { ComplaintReason } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/trim.decorator';

// Жалуются либо на объявление, либо на пользователя: что именно — проверяет сервис
export class CreateComplaintDto {
  @IsOptional()
  @IsInt({ message: 'Укажите объявление' })
  adId?: number;

  @IsOptional()
  @IsInt({ message: 'Укажите пользователя' })
  userId?: number;

  @IsEnum(ComplaintReason, { message: 'Выберите причину жалобы' })
  reason!: ComplaintReason;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000, {
    message: 'Комментарий должен быть не длиннее 1000 символов',
  })
  comment?: string;
}
