import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const MAX_IMAGES = 5;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type UploadedImage = Pick<
  Express.Multer.File,
  'mimetype' | 'size' | 'buffer'
>;

// Папка загрузок; сервер раздаёт её по адресу /uploads
export function uploadDir(config: ConfigService): string {
  return resolve(config.get<string>('UPLOAD_DIR', 'uploads'));
}

// Сохраняет фотографии объявлений на диск под случайными именами
@Injectable()
export class ImageStorage {
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = uploadDir(config);
  }

  validate(files: UploadedImage[]): void {
    if (files.length > MAX_IMAGES) {
      throw new BadRequestException(
        `Можно прикрепить не больше ${MAX_IMAGES} фото`,
      );
    }
    for (const file of files) {
      if (!EXTENSIONS[file.mimetype]) {
        throw new BadRequestException(
          'Фото должны быть в формате JPG, PNG или WEBP',
        );
      }
      if (file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestException('Каждое фото должно быть не больше 5 МБ');
      }
    }
  }

  async save(files: UploadedImage[]): Promise<string[]> {
    await mkdir(this.dir, { recursive: true });
    const names = files.map((f) => `${randomUUID()}.${EXTENSIONS[f.mimetype]}`);
    await Promise.all(
      files.map((f, i) => writeFile(join(this.dir, names[i]), f.buffer)),
    );
    return names;
  }

  async remove(names: string[]): Promise<void> {
    await Promise.all(names.map((n) => rm(join(this.dir, n), { force: true })));
  }
}
