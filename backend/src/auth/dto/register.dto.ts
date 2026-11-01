import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  @MaxLength(64)
  password!: string;

  @Trim()
  @IsString()
  @MinLength(2, { message: 'Имя должно быть не короче 2 символов' })
  @MaxLength(50)
  name!: string;
}
