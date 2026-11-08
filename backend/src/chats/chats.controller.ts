import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Message } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatsGateway } from './chats.gateway';
import { ChatsService, type ChatSummary } from './chats.service';
import { OpenChatDto } from './dto/open-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

// Переписка есть только у вошедших пользователей
@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatsGateway: ChatsGateway,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<ChatSummary[]> {
    return this.chatsService.findAll(user.sub);
  }

  // Покупатель открывает диалог с автором объявления
  @Post()
  open(
    @CurrentUser() user: JwtPayload,
    @Body() dto: OpenChatDto,
  ): Promise<ChatSummary> {
    return this.chatsService.open(user.sub, dto.adId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ChatSummary> {
    return this.chatsService.findOne(id, user.sub);
  }

  @Get(':id/messages')
  findMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Message[]> {
    return this.chatsService.findMessages(id, user.sub);
  }

  // Резервный путь, если WebSocket недоступен: собеседник всё равно получит сообщение сразу
  @Post(':id/messages')
  async send(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ): Promise<Message> {
    const sent = await this.chatsService.send(id, user.sub, dto.text);
    this.chatsGateway.deliver(sent);
    return sent.message;
  }
}
