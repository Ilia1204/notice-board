import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ImageStorage,
  imageExtension,
  MAX_IMAGE_SIZE,
  MAX_IMAGES,
} from './image-storage.service';

// Начало настоящих файлов каждого формата
const HEADERS = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'),
  pdf: Buffer.from('%PDF-1.7'),
};

const image = (type: keyof typeof HEADERS = 'png', size = 100) => ({
  size,
  buffer: HEADERS[type],
});

describe('ImageStorage', () => {
  let dir: string;
  let storage: ImageStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'images-'));
    storage = new ImageStorage(new ConfigService({ UPLOAD_DIR: dir }));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('пропускает фото JPG, PNG и WEBP', () => {
    const files = [image('jpg'), image('png'), image('webp')];
    expect(() => storage.validate(files)).not.toThrow();
  });

  it('пропускает 10 фото и не принимает больше', () => {
    expect(MAX_IMAGES).toBe(10);
    const photos = (n: number) => Array.from({ length: n }, () => image());
    expect(() => storage.validate(photos(10))).not.toThrow();
    expect(() => storage.validate(photos(11))).toThrow(
      'Можно прикрепить не больше 10 фото',
    );
  });

  it('не принимает другие форматы', () => {
    expect(() => storage.validate([image('pdf')])).toThrow(BadRequestException);
  });

  it('определяет формат по содержимому файла, а не по его типу', () => {
    expect(imageExtension(HEADERS.jpg)).toBe('jpg');
    expect(imageExtension(HEADERS.png)).toBe('png');
    expect(imageExtension(HEADERS.webp)).toBe('webp');
    expect(imageExtension(HEADERS.pdf)).toBeNull();
    expect(imageExtension(Buffer.from('fake image'))).toBeNull();
  });

  it('не принимает фото больше 5 МБ', () => {
    expect(() => storage.validate([image('jpg', MAX_IMAGE_SIZE + 1)])).toThrow(
      'Каждое фото должно быть не больше 5 МБ',
    );
  });

  it('сохраняет фото под случайными именами и удаляет их', async () => {
    const names = await storage.save([image('jpg'), image('png')]);

    expect(names).toEqual([
      expect.stringMatching(/^[\w-]+\.jpg$/),
      expect.stringMatching(/^[\w-]+\.png$/),
    ]);
    expect(await readFile(join(dir, names[0]))).toEqual(HEADERS.jpg);

    await storage.remove(names);
    expect(await readdir(dir)).toEqual([]);
  });
});
