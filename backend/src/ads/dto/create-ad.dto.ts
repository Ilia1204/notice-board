import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAdDto {
  @IsString()
  @MinLength(3, { message: 'Заголовок должен быть не короче 3 символов' })
  @MaxLength(100, { message: 'Заголовок должен быть не длиннее 100 символов' })
  title!: string;

  @IsString()
  @MinLength(10, { message: 'Описание должно быть не короче 10 символов' })
  @MaxLength(2000, {
    message: 'Описание должно быть не длиннее 2000 символов',
  })
  description!: string;

  // Без цены объявление считается «договорным»
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Цена должна быть целым числом' })
  @Min(0, { message: 'Цена не может быть отрицательной' })
  @Max(1_000_000_000, { message: 'Слишком большая цена' })
  price?: number;

  @Type(() => Number)
  @IsInt({ message: 'Выберите категорию' })
  categoryId!: number;
}
