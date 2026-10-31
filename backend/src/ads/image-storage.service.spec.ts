import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImageStorage, MAX_IMAGE_SIZE } from './image-storage.service';

const image = (mimetype = 'image/png', size = 100) => ({
  mimetype,
  size,
  buffer: Buffer.from('fake image'),
});

describe('ImageStorage', () => {
  let dir: string;
  let storage: ImageStorage;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'images-'));
    storage = new ImageStorage(new ConfigService({ UPLOAD_DIR: dir }));
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('пропускает до 5 фото JPG, PNG и WEBP', () => {
    const files = ['image/jpeg', 'image/png', 'image/webp'].map((t) =>
      image(t),
    );
    expect(() => storage.validate(files)).not.toThrow();
  });

  it('не принимает больше 5 фото', () => {
    expect(() =>
      storage.validate(Array.from({ length: 6 }, () => image())),
    ).toThrow('Можно прикрепить не больше 5 фото');
  });

  it('не принимает другие форматы', () => {
    expect(() => storage.validate([image('application/pdf')])).toThrow(
      BadRequestException,
    );
  });

  it('не принимает фото больше 5 МБ', () => {
    expect(() =>
      storage.validate([image('image/jpeg', MAX_IMAGE_SIZE + 1)]),
    ).toThrow('Каждое фото должно быть не больше 5 МБ');
  });

  it('сохраняет фото под случайными именами и удаляет их', async () => {
    const names = await storage.save([image('image/jpeg'), image('image/png')]);

    expect(names).toEqual([
      expect.stringMatching(/^[\w-]+\.jpg$/),
      expect.stringMatching(/^[\w-]+\.png$/),
    ]);
    expect(await readFile(join(dir, names[0]), 'utf8')).toBe('fake image');

    await storage.remove(names);
    expect(await readdir(dir)).toEqual([]);
  });
});
