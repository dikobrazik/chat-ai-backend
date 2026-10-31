import { BadRequestException } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { ALIBABA_IMAGE_MODELS } from '../alibaba-models';
import { AlibabaImageClient } from '../providers/alibaba-image.client';

jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn() }));

describe(AlibabaImageClient.name, () => {
  const client = new AlibabaImageClient(
    'test-key',
    'https://workspace.example/api/v1',
  );
  const imageURL = 'https://results.example/image.png?signed=value';
  const file = {
    id: 'image-id',
    name: 'image.png',
    mimeType: 'image/png',
    blob: new Blob(['image']),
  };
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const model = (name: string) =>
    ALIBABA_IMAGE_MODELS.find((item) => item.name === name);
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const image = () =>
    new Response('generated-image', {
      headers: { 'Content-Type': 'image/png' },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(delay).mockResolvedValue(undefined);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('Генерирует и редактирует Qwen Image через DashScope и скачивает результат без API-ключа', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          request_id: 'request-id',
          output: {
            choices: [{ message: { content: [{ image: imageURL }] } }],
          },
        }),
      )
      .mockResolvedValueOnce(image());

    await expect(
      client.generate(
        model('qwen-image-2.0-pro'),
        'Измени фон',
        [file],
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      id: 'request-id',
      imageB64: Buffer.from('generated-image').toString('base64'),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://workspace.example/api/v1/services/aigc/multimodal-generation/generation',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      model: 'qwen-image-2.0-pro',
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: 'data:image/png;base64,aW1hZ2U=' },
              { text: 'Измени фон' },
            ],
          },
        ],
      },
      parameters: { n: 1 },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, new URL(imageURL), {
      signal: expect.any(AbortSignal),
    });
  });

  it('Создаёт одну асинхронную задачу Wan и опрашивает её до результата', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ output: { task_id: 'task-id', task_status: 'PENDING' } }),
      )
      .mockResolvedValueOnce(
        json({ output: { task_id: 'task-id', task_status: 'RUNNING' } }),
      )
      .mockResolvedValueOnce(
        json({
          output: {
            task_id: 'task-id',
            task_status: 'SUCCEEDED',
            results: [{ url: imageURL }],
          },
        }),
      )
      .mockResolvedValueOnce(image());
    await expect(
      client.generate(
        model('wan2.2-t2i-flash'),
        'Кот',
        [],
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ id: 'task-id' });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://workspace.example/api/v1/services/aigc/text2image/image-synthesis',
    );
    expect(fetchMock.mock.calls[0][1].headers).toHaveProperty(
      'X-DashScope-Async',
      'enable',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      model: 'wan2.2-t2i-flash',
      input: { prompt: 'Кот' },
      parameters: { n: 1 },
    });
    expect(
      fetchMock.mock.calls.filter(([, init]) => init.method === 'POST'),
    ).toHaveLength(1);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://workspace.example/api/v1/tasks/task-id',
    );
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it('Использует протокол messages для Wan 2.6, а не старый text2image', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          output: {
            task_id: 'task-id',
            task_status: 'SUCCEEDED',
            results: [{ url: imageURL }],
          },
        }),
      )
      .mockResolvedValueOnce(image());
    await client.generate(
      model('wan2.6-t2i'),
      'Кот',
      [],
      new AbortController().signal,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://workspace.example/api/v1/services/aigc/image-generation/generation',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).input).toEqual({
      messages: [{ role: 'user', content: [{ text: 'Кот' }] }],
    });
  });

  it('Ограничивает Wan 2.6 одним изображением при генерации без референсов', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          output: {
            task_id: 'task-id',
            task_status: 'SUCCEEDED',
            choices: [{ message: { content: [{ image: imageURL }] } }],
          },
        }),
      )
      .mockResolvedValueOnce(image());
    await client.generate(
      model('wan2.6-image'),
      'Кот',
      [],
      new AbortController().signal,
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://workspace.example/api/v1/services/aigc/image-generation/generation',
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1].body)).parameters,
    ).toEqual({
      n: 1,
      enable_interleave: true,
      max_images: 1,
    });
  });

  it.each(['wan2.5-i2i-preview', 'wanx2.1-imageedit'])(
    'Передаёт референс по протоколу редактирования %s',
    async (name) => {
      fetchMock
        .mockResolvedValueOnce(
          json({
            output: {
              task_id: 'task-id',
              task_status: 'SUCCEEDED',
              results: [{ url: imageURL }],
            },
          }),
        )
        .mockResolvedValueOnce(image());
      await client.generate(
        model(name),
        'Измени фон',
        [file],
        new AbortController().signal,
      );
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://workspace.example/api/v1/services/aigc/image2image/image-synthesis',
      );
      expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).input).toEqual(
        name === 'wanx2.1-imageedit'
          ? {
              prompt: 'Измени фон',
              base_image_url: 'data:image/png;base64,aW1hZ2U=',
              function: 'description_edit',
            }
          : {
              prompt: 'Измени фон',
              images: ['data:image/png;base64,aW1hZ2U='],
            },
      );
    },
  );

  it.each([
    ['z-image-turbo', [file]],
    ['qwen-image-2.0', Array(4).fill(file)],
    ['wan2.5-i2i-preview', []],
    ['qwen-image-2.0', [{ ...file, mimeType: 'application/pdf' }]],
  ])(
    'Отклоняет неподдерживаемые входные изображения для %s до отправки запроса',
    async (name, files) => {
      await expect(
        client.generate(
          model(name),
          'Тест',
          files,
          new AbortController().signal,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('Не скрывает ошибку API с HTTP 200 и не скачивает несуществующий результат', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ code: 'InvalidApiKey', message: 'Invalid key' }),
    );
    await expect(
      client.generate(
        model('z-image-turbo'),
        'Кот',
        [],
        new AbortController().signal,
      ),
    ).rejects.toThrow('Invalid key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Останавливается при неуспешном статусе асинхронной задачи', async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ output: { task_id: 'task-id', task_status: 'PENDING' } }),
      )
      .mockResolvedValueOnce(
        json({
          output: {
            task_id: 'task-id',
            task_status: 'FAILED',
            message: 'Content rejected',
          },
        }),
      );
    await expect(
      client.generate(
        model('wan2.1-t2i-plus'),
        'Кот',
        [],
        new AbortController().signal,
      ),
    ).rejects.toThrow('Content rejected');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Отклоняет успешный ответ без картинки', async () => {
    fetchMock.mockResolvedValueOnce(
      json({ request_id: 'request-id', output: {} }),
    );
    await expect(
      client.generate(
        model('z-image-turbo'),
        'Кот',
        [],
        new AbortController().signal,
      ),
    ).rejects.toThrow('No image received');
  });

  it('Ограничивает время генерации и прерывает HTTP-запрос', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(init.signal.reason),
            { once: true },
          );
        }),
    );
    const result = client.generate(
      model('z-image-turbo'),
      'Кот',
      [],
      new AbortController().signal,
    );
    const assertion = expect(result).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(600_001);
    await assertion;
  });
});
