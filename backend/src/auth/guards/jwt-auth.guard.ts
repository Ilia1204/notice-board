import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Пропускает только запросы с действительным JWT-токеном
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
