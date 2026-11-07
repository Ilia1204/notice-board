import { IsInt } from 'class-validator';

export class OpenChatDto {
  @IsInt({ message: 'Укажите объявление' })
  adId!: number;
}
