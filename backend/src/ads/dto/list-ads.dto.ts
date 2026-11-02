import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator';

// Фильтры списка объявлений: рубрика и поиск по названию
export class ListAdsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Неверная категория' })
  categoryId?: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100, { message: 'Слишком длинный запрос' })
  q?: string;
}
