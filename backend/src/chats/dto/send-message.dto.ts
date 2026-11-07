import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/trim.decorator';

export class SendMessageDto {
  @Trim()
  @IsString()
  @MinLength(1, { message: 'Сообщение не может быть пустым' })
  @MaxLength(2000, {
    message: 'Сообщение должно быть не длиннее 2000 символов',
  })
  text!: string;
}
