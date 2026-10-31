import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestBed } from '@suites/unit';
import { Readable } from 'stream';
import { FileEntity } from 'src/entities/File';
import { FileStorageService } from '../file-storage.service';
import { Repository } from 'typeorm';

describe(FileStorageService.name, () => {
  const settings = {
    S3_ENDPOINT: 'https://storage.example.com',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    GENERATED_IMAGES_BUCKET_NAME: 'generated-images',
    USER_FILES_BUCKET_NAME: 'user-files',
  };

  async function createService(overrides: Record<string, string> = {}) {
    const values: Record<string, string> = { ...settings, ...overrides };

    return TestBed.solitary(FileStorageService)
      .mock(ConfigService)
      .impl(() => ({
        get: jest.fn((key: string) => values[key]),
      }))
      .compile();
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([undefined, 'false'])(
    'Сохраняет адресацию облачного S3 при флаге %s',
    async (flag) => {
      const { unit } = await createService(
        flag === undefined ? {} : { S3_FORCE_PATH_STYLE: flag },
      );
      const url = new URL(await unit.getPromptImageUrl('chat', 'prompt'));

      expect(url.origin).toBe('https://generated-images.storage.example.com');
      expect(url.pathname).toBe('/chat/prompt.png');
      expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
    },
  );

  it.each(['true', ' TRUE '])(
    'Формирует path-style ссылку с HTTPS и портом при флаге %s',
    async (flag) => {
      const { unit } = await createService({
        S3_ENDPOINT: 'https://jonu.ru:9443',
        S3_FORCE_PATH_STYLE: flag,
      });
      const url = new URL(await unit.getPromptImageUrl('chat', 'prompt'));

      expect(url.origin).toBe('https://jonu.ru:9443');
      expect(url.pathname).toBe('/generated-images/chat/prompt.png');
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
      expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    },
  );

  it('Загружает изображение по внутреннему адресу, а ссылку подписывает для публичного', async () => {
    const clients: S3Client[] = [];
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(function (this: S3Client) {
        clients.push(this);
        return Promise.resolve({});
      });
    const { unit } = await createService({
      S3_ENDPOINT: 'https://jonu.ru:9443',
      S3_INTERNAL_ENDPOINT: 'http://seaweedfs:8333',
      S3_FORCE_PATH_STYLE: 'true',
    });

    await unit.saveGeneratedImage('prompt', 'chat', 'aW1hZ2U=');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'generated-images',
          Key: 'chat/prompt.png',
          Body: Buffer.from('image'),
        },
      }),
    );
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    await expect(clients[0].config.endpoint()).resolves.toMatchObject({
      hostname: 'seaweedfs',
      port: 8333,
      protocol: 'http:',
    });

    const url = new URL(await unit.getPromptImageUrl('chat', 'prompt'));
    expect(url.origin).toBe('https://jonu.ru:9443');
    expect(url.pathname).toBe('/generated-images/chat/prompt.png');
  });

  it('Использует внутреннее хранилище и прежний ключ при загрузке файлов пользователя', async () => {
    const clients: S3Client[] = [];
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(function (this: S3Client) {
        clients.push(this);
        return Promise.resolve({});
      });
    const { unit, unitRef } = await createService({
      S3_INTERNAL_ENDPOINT: 'http://seaweedfs:8333',
      S3_FORCE_PATH_STYLE: 'true',
    });
    const repository = unitRef.get<Repository<FileEntity>>(
      getRepositoryToken(FileEntity) as string,
    );
    const file = Object.assign(new FileEntity(), { id: 'file-id' });
    repository.create.mockReturnValue(file);
    repository.save.mockImplementation(jest.fn().mockResolvedValue([file]));

    await expect(
      unit.uploadFiles('user', [
        {
          originalname: 'image.png',
          fieldname: 'files',
          encoding: '7bit',
          mimetype: 'image/png',
          size: 5,
          buffer: Buffer.from('image'),
          stream: Readable.from(['image']),
          destination: '',
          filename: 'image.png',
          path: '',
        },
      ]),
    ).resolves.toEqual(['file-id']);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          Bucket: 'user-files',
          Key: 'user/image.png',
          Body: Buffer.from('image'),
        },
      }),
    );
    expect(repository.create).toHaveBeenCalledWith({
      name: 'image.png',
      size: 5,
      type: 'image/png',
      bucket: 'user-files',
      bucket_key: 'user/image.png',
      owner_id: 'user',
    });
    await expect(clients[0].config.endpoint()).resolves.toMatchObject({
      hostname: 'seaweedfs',
      port: 8333,
    });
  });

  it('Не запускается с внутренним адресом без публичного адреса для ссылок', async () => {
    await expect(
      createService({
        S3_ENDPOINT: '',
        S3_INTERNAL_ENDPOINT: 'http://seaweedfs:8333',
      }),
    ).rejects.toThrow(
      'S3_ENDPOINT is required when S3_INTERNAL_ENDPOINT is configured',
    );
  });

  it('Не сообщает об успешном сохранении изображения при ошибке S3', async () => {
    const error = new Error('Storage unavailable');
    jest
      .spyOn(S3Client.prototype, 'send')
      .mockImplementation(() => Promise.reject(error));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { unit } = await createService();
    await expect(
      unit.saveGeneratedImage('prompt', 'chat', 'aW1hZ2U='),
    ).rejects.toBe(error);
    expect(log).toHaveBeenCalledWith('Error uploading file:', error);
  });
});
