import { IsInt } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

// Отправка через WebSocket: номер диалога приходит в теле события
export class WsSendMessageDto extends SendMessageDto {
  @IsInt({ message: 'Не указан диалог' })
  chatId!: number;
}
