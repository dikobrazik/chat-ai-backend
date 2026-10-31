import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestBed, Mocked } from '@suites/unit';
import OpenAI from 'openai';
import { toArray, lastValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Prompt } from 'src/entities/Prompt';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { AlibabaProviderService } from '../providers/alibaba.provider';
import { AlibabaImageClient } from '../providers/alibaba-image.client';

const mockCreate = jest.fn();
const mockResponsesCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
    responses: { create: mockResponsesCreate },
  })),
}));

const chunk = (
  delta: { content?: string; reasoning_content?: string },
  finishReason: string | null = null,
) => ({
  id: 'response-id',
  choices: [{ index: 0, delta, finish_reason: finishReason }],
});

async function* streamChunks(chunks: object[]) {
  yield* chunks;
}

describe(AlibabaProviderService.name, () => {
  let provider: AlibabaProviderService;
  let repository: Mocked<Repository<Prompt>>;
  let fileStorage: Mocked<FileStorageService>;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCreate.mockReset();
    mockResponsesCreate.mockReset();
    const config: Record<string, string> = {
      ALIBABA_API_KEY: 'test-key',
      ALIBABA_BASE_URL: 'https://workspace.example/compatible-mode/v1',
    };
    const { unit, unitRef } = await TestBed.solitary(AlibabaProviderService)
      .mock(ConfigService)
      .impl(() => ({
        get: jest.fn((key: string) => config[key]),
        getOrThrow: jest.fn((key: string) => config[key]),
      }))
      .mock(getRepositoryToken(Prompt) as string)
      .impl(() => ({ find: jest.fn() }))
      .mock(FileStorageService)
      .impl(() => ({ getFilesByIds: jest.fn() }))
      .compile();
    provider = unit;
    repository = unitRef.get(getRepositoryToken(Prompt) as string);
    fileStorage = unitRef.get(FileStorageService);
    repository.find.mockResolvedValue([
      Object.assign(new Prompt(), {
        input: 'Первый вопрос',
        response: 'Первый ответ',
      }),
    ]);
  });

  it('Передаёт историю, thinking и поиск и дожидается отдельного пакета usage', async () => {
    mockCreate.mockResolvedValueOnce(
      streamChunks([
        chunk({}),
        chunk({ reasoning_content: 'Размышление' }),
        chunk({ content: 'При' }),
        chunk({ content: 'вет' }, 'stop'),
        {
          id: 'response-id',
          choices: [],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 7,
            completion_tokens_details: { reasoning_tokens: 3 },
          },
        },
      ]),
    );

    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen-plus',
      'Второй вопрос',
      { withThinking: true, withSearch: true },
    );
    const events = await lastValueFrom(stream.pipe(toArray()));

    expect(repository.find).toHaveBeenCalledWith({
      where: { chat_id: 'chat-id' },
      order: { created_at: 'ASC', id: 'ASC' },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      {
        model: 'qwen-plus',
        messages: [
          { role: 'user', content: 'Первый вопрос' },
          { role: 'assistant', content: 'Первый ответ' },
          { role: 'user', content: 'Второй вопрос' },
        ],
        stream: true,
        stream_options: { include_usage: true },
        enable_thinking: true,
        enable_search: true,
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(events.map((event) => event.type)).toEqual([
      'thinking',
      'delta',
      'delta',
      'meta',
      'complete',
    ]);
    expect(events[0]).toEqual(
      expect.objectContaining({
        content: 'Размышление',
        promptId: 'response-id',
      }),
    );
    expect(events[3]).toEqual({
      type: 'meta',
      promptId: 'response-id',
      inputTokens: 10,
      outputTokens: 7,
      thinkingTokens: 3,
    });
    expect(events[4]).toEqual(
      expect.objectContaining({
        type: 'complete',
        content: 'Привет',
        isComplete: true,
      }),
    );
  });

  it('Работает без истории, настроек и статистики reasoning', async () => {
    mockCreate.mockResolvedValueOnce(
      streamChunks([
        chunk({ content: 'Ответ' }, 'stop'),
        {
          id: 'response-id',
          choices: [],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        },
      ]),
    );
    const stream = await provider.generateStreamResponse(
      undefined,
      'qwen-flash',
      'Вопрос',
    );
    const events = await lastValueFrom(stream.pipe(toArray()));

    expect(repository.find).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'Вопрос' }],
        enable_thinking: false,
        enable_search: false,
      }),
      expect.any(Object),
    );
    expect(events[1]).toEqual(
      expect.objectContaining({ type: 'meta', thinkingTokens: 0 }),
    );
    expect(events[2]).toEqual(
      expect.objectContaining({ type: 'complete', content: 'Ответ' }),
    );
  });

  it('Завершает поток без статистики токенов', async () => {
    mockCreate.mockResolvedValueOnce(
      streamChunks([chunk({ content: 'Ответ' }, 'stop')]),
    );
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen-flash',
      'Вопрос',
    );
    const events = await lastValueFrom(stream.pipe(toArray()));
    expect(events.map((event) => event.type)).toEqual(['delta', 'complete']);
  });

  it('Не считает оборванный поток успешным ответом', async () => {
    mockCreate.mockResolvedValueOnce(
      streamChunks([chunk({ content: 'Часть ответа' })]),
    );
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen-plus',
      'Вопрос',
    );
    await expect(lastValueFrom(stream.pipe(toArray()))).rejects.toEqual(
      expect.objectContaining({
        type: 'error',
        error: 'Alibaba stream ended before completion',
      }),
    );
  });

  it('Передаёт ошибку API в стандартном формате потока', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Invalid API key'));
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen-plus',
      'Вопрос',
    );
    await expect(lastValueFrom(stream.pipe(toArray()))).rejects.toEqual(
      expect.objectContaining({ type: 'error', error: 'Invalid API key' }),
    );
  });

  it('Отменяет запрос при отписке', async () => {
    mockCreate.mockImplementationOnce(
      (_request, { signal }: { signal: AbortSignal }) => {
        expect(signal.aborted).toBe(false);
        return new Promise(() => {});
      },
    );
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen-plus',
      'Вопрос',
    );
    const subscription = stream.subscribe();
    const signal: AbortSignal = mockCreate.mock.calls[0][1].signal;
    subscription.unsubscribe();
    expect(signal.aborted).toBe(true);
  });

  it('Отклоняет вложения у текстовой модели и неизвестную модель изображений', async () => {
    await expect(
      provider.generateStreamResponse('chat-id', 'qwen-plus', 'Вопрос', {
        files: [
          {
            id: 'file-id',
            blob: new Blob(['text']),
            name: 'file.txt',
            mimeType: 'text/plain',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      provider.generateImageResponse('chat-id', 'qwen-plus', 'Картинка'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('Собирает обычный ответ из потока, включая модели только с потоковым API', async () => {
    mockCreate.mockResolvedValueOnce(
      streamChunks([chunk({ content: 'Ответ' }, 'stop')]),
    );
    await expect(
      provider.generateResponse('chat-id', 'qwen-plus', 'Вопрос'),
    ).resolves.toEqual({ id: 'response-id', text: 'Ответ' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen-plus',
        enable_thinking: false,
      }),
      expect.any(Object),
    );
  });

  it('Позволяет переопределить адрес API для нужного региона', () => {
    new AlibabaProviderService(
      new ConfigService({
        ALIBABA_API_KEY: 'regional-key',
        ALIBABA_BASE_URL: 'https://workspace.example/compatible-mode/v1',
      }),
    );
    expect(OpenAI).toHaveBeenLastCalledWith({
      apiKey: 'regional-key',
      baseURL: 'https://workspace.example/compatible-mode/v1',
    });
  });

  it('Не отправляет переключатель thinking для модели с обязательным reasoning', async () => {
    mockCreate.mockResolvedValueOnce(
      streamChunks([chunk({ content: 'Ответ' }, 'stop')]),
    );
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'kimi-k3',
      'Вопрос',
    );
    await lastValueFrom(stream);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('enable_thinking');
  });

  it('Не отправляет неподдерживаемые параметры старым моделям и явно отклоняет поиск', async () => {
    mockCreate.mockResolvedValueOnce(
      streamChunks([chunk({ content: 'Ответ' }, 'stop')]),
    );
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen-long',
      'Вопрос',
    );
    await lastValueFrom(stream);
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('enable_thinking');
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('enable_search');
    await expect(
      provider.generateStreamResponse('chat-id', 'qwen-long', 'Вопрос', {
        withSearch: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Передаёт текущие и исторические изображения в vision-модель', async () => {
    const image = {
      id: 'image-id',
      name: 'image.png',
      mimeType: 'image/png',
      blob: new Blob(['image']),
    };
    repository.find.mockResolvedValueOnce([
      Object.assign(new Prompt(), {
        input: 'Что на фото?',
        response: 'Кот',
        files: [{ file_id: image.id }],
      }),
    ]);
    fileStorage.getFilesByIds.mockResolvedValueOnce([image]);
    mockCreate.mockResolvedValueOnce(
      streamChunks([chunk({ content: 'Кот' }, 'stop')]),
    );
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen3.8-max',
      'Сравни фотографии',
      { files: [image] },
    );
    await lastValueFrom(stream);

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { files: true } }),
    );
    expect(fileStorage.getFilesByIds).toHaveBeenCalledWith(['image-id']);
    const imagePart = {
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aW1hZ2U=' },
    };
    expect(mockCreate.mock.calls[0][0].messages).toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Что на фото?' }, imagePart],
      },
      { role: 'assistant', content: 'Кот' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Сравни фотографии' }, imagePart],
      },
    ]);
  });

  it('Использует Responses API для встроенного поиска новых Qwen', async () => {
    repository.find.mockResolvedValueOnce([]);
    mockResponsesCreate.mockResolvedValueOnce(
      streamChunks([
        { type: 'response.created', response: { id: 'response-id' } },
        {
          type: 'response.output_text.delta',
          delta: 'Результат поиска',
          sequence_number: 1,
        },
        {
          type: 'response.completed',
          response: {
            id: 'response-id',
            usage: {
              input_tokens: 3,
              output_tokens: 5,
              output_tokens_details: { reasoning_tokens: 2 },
            },
          },
        },
      ]),
    );
    const stream = await provider.generateStreamResponse(
      'chat-id',
      'qwen3.8-max',
      'Новости',
      { withSearch: true, withThinking: true },
    );
    const events = await lastValueFrom(stream.pipe(toArray()));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen3.8-max',
        tools: [{ type: 'web_search' }],
        reasoning: { effort: 'high' },
      }),
      expect.any(Object),
    );
    expect(events.map((event) => event.type)).toEqual([
      'delta',
      'meta',
      'complete',
    ]);
    expect(events[2]).toMatchObject({ content: 'Результат поиска' });
  });

  it('Подключает Wan к единому потоку изображений и передаёт вложения', async () => {
    const generate = jest
      .spyOn(AlibabaImageClient.prototype, 'generate')
      .mockResolvedValueOnce({
        id: 'task-id',
        imageB64: 'aW1hZ2U=',
      });
    const file = {
      id: 'image-id',
      name: 'image.png',
      mimeType: 'image/png',
      blob: new Blob(['image']),
    };
    const stream = await provider.generateImageResponse(
      'chat-id',
      'wan2.7-image',
      'Измени фон',
      { files: [file] },
    );
    const events = await lastValueFrom(stream.pipe(toArray()));
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'wan2.7-image' }),
      'Измени фон',
      [file],
      expect.any(AbortSignal),
    );
    expect(events).toEqual([
      expect.objectContaining({
        type: 'complete',
        promptId: 'task-id',
        imageB64: 'aW1hZ2U=',
        isComplete: true,
      }),
    ]);
  });
});
