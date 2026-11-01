import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator';

export class CreateCategoryDto {
  @Trim()
  @IsString()
  @MinLength(2, { message: 'Название должно быть не короче 2 символов' })
  @MaxLength(50, { message: 'Название должно быть не длиннее 50 символов' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Описание должно быть не длиннее 200 символов' })
  description?: string;
}
