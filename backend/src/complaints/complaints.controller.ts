import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  ComplaintsService,
  type ComplaintWithRelations,
} from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';

// Пожаловаться может любой вошедший, разбирает жалобы только модератор
@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateComplaintDto,
  ): Promise<ComplaintWithRelations> {
    return this.complaintsService.create(user.sub, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.MODERATOR)
  findOpen(): Promise<ComplaintWithRelations[]> {
    return this.complaintsService.findOpen();
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.MODERATOR)
  @HttpCode(204)
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveComplaintDto,
  ): Promise<void> {
    return this.complaintsService.resolve(id, dto.status);
  }
}
