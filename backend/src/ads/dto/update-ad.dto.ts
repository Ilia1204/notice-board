import { Transform } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';
import { CreateAdDto } from './create-ad.dto';

// Форма редактирования присылает все поля: пустая цена снова значит «договорная»
export class UpdateAdDto extends CreateAdDto {
  // В форме одно значение приходит строкой, несколько — массивом
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => [value].flat().map(Number))
  @IsInt({ each: true, message: 'Неверный номер фото' })
  removeImageIds?: number[];
}
