import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { uploadDir } from './ads/image-storage.service';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // CLIENT_URL — один или несколько адресов клиента через запятую
  const origins = (process.env.CLIENT_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Фото объявлений доступны по адресу /uploads/<имя файла>
  app.useStaticAssets(uploadDir(app.get(ConfigService)), {
    prefix: '/uploads/',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
