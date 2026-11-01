import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const MAX_IMAGES = 5;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const TOO_MANY_IMAGES = `Можно прикрепить не больше ${MAX_IMAGES} фото`;
export const WRONG_IMAGE_FORMAT =
  'Фото должны быть в формате JPG, PNG или WEBP';
export const IMAGE_TOO_LARGE = 'Каждое фото должно быть не больше 5 МБ';

export type UploadedImage = Pick<Express.Multer.File, 'size' | 'buffer'>;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

// Формат фото определяем по первым байтам файла, а не по типу,
// который прислал клиент: его легко подменить
export function imageExtension(buffer: Buffer): string | null {
  if (buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) return 'jpg';
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

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
      throw new BadRequestException(TOO_MANY_IMAGES);
    }
    for (const file of files) {
      if (!imageExtension(file.buffer)) {
        throw new BadRequestException(WRONG_IMAGE_FORMAT);
      }
      if (file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestException(IMAGE_TOO_LARGE);
      }
    }
  }

  async save(files: UploadedImage[]): Promise<string[]> {
    await mkdir(this.dir, { recursive: true });
    const names = files.map(
      (f) => `${randomUUID()}.${imageExtension(f.buffer)}`,
    );
    await Promise.all(
      files.map((f, i) => writeFile(join(this.dir, names[i]), f.buffer)),
    );
    return names;
  }

  async remove(names: string[]): Promise<void> {
    await Promise.all(names.map((n) => rm(join(this.dir, n), { force: true })));
  }
}
