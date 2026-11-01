import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import multer, { memoryStorage, MulterError } from 'multer';
import { Observable } from 'rxjs';
import {
  IMAGE_TOO_LARGE,
  MAX_IMAGE_SIZE,
  MAX_IMAGES,
  TOO_MANY_IMAGES,
} from './image-storage.service';

const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
}).array('images', MAX_IMAGES);

// Принимает фото объявления (поле images). Стандартный FilesInterceptor
// отдаёт ошибки multer по-английски, здесь они переводятся по коду ошибки
@Injectable()
export class AdImagesInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    await new Promise<void>((resolve, reject) =>
      upload(
        http.getRequest<Request>(),
        http.getResponse<Response>(),
        (error: unknown) => (error ? reject(uploadError(error)) : resolve()),
      ),
    );
    return next.handle();
  }
}

function uploadError(error: unknown): BadRequestException {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new BadRequestException(IMAGE_TOO_LARGE);
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return new BadRequestException(
        error.field === 'images'
          ? TOO_MANY_IMAGES
          : 'Фото нужно прикреплять в поле images',
      );
    }
  }
  return new BadRequestException('Не удалось прочитать форму с фото');
}
