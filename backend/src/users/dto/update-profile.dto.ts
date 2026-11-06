import { PickType } from '@nestjs/mapped-types';
import { RegisterDto } from '../../auth/dto/register.dto';

// Форма профиля присылает оба поля, проверки те же, что при регистрации
export class UpdateProfileDto extends PickType(RegisterDto, [
  'email',
  'name',
]) {}
