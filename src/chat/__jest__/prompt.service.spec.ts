import { TestBed, type Mocked } from '@suites/unit';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EMPTY, lastValueFrom, of } from 'rxjs';
import { Chat } from 'src/entities/Chat';
import { Model } from 'src/entities/Model';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { ModelProviderService } from 'src/model-provider/model-provider.service';
import { UnifiedAIStreamChunk } from 'src/model-provider/model-provider.interface';
import { Prompt } from 'src/entities/Prompt';
import { PromptFile } from 'src/entities/PromptFile';
import { PromptMeta } from 'src/entities/PromptMeta';
import { type Repository, type SelectQueryBuilder } from 'typeorm';
import { ChatTitleGeneratorService } from '../chat-title-generator.service';
import { PromptService } from '../prompt.service';

const promptRepositoryToken = getRepositoryToken(Prompt) as string;

describe(PromptService.name, () => {
  let promptService: PromptService;
  let promptRepositoryMock: Mocked<Repository<Prompt>>;
  let modelProviderMock: Mocked<ModelProviderService>;
  let fileStorageMock: Mocked<FileStorageService>;
  let promptFileRepositoryMock: Mocked<Repository<PromptFile>>;
  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(PromptService)
      .mock(ModelProviderService)
      .impl(() => ({
        generateStreamResponse: jest.fn(),
        generateImageResponse: jest.fn(),
      }))
      .mock(ChatTitleGeneratorService)
      .impl(() => ({}))
      .mock(FileStorageService)
      .impl(() => ({ getFilesByIds: jest.fn(), saveGeneratedImage: jest.fn() }))
      .mock(promptRepositoryToken)
      .impl(() => ({ createQueryBuilder: jest.fn(), insert: jest.fn() }))
      .mock(getRepositoryToken(PromptFile) as string)
      .impl(() => ({ insert: jest.fn() }))
      .mock(getRepositoryToken(PromptMeta) as string)
      .impl(() => ({}))
      .compile();

    promptService = unit;
    promptRepositoryMock = unitRef.get(promptRepositoryToken);
    modelProviderMock = unitRef.get(ModelProviderService);
    fileStorageMock = unitRef.get(FileStorageService);
    promptFileRepositoryMock = unitRef.get(
      getRepositoryToken(PromptFile) as string,
    );
  });

  it('Передаёт внутренний ID чата провайдеру Alibaba для загрузки истории', async () => {
    const chat = Object.assign(new Chat(), {
      id: 'chat-id',
      title: 'Диалог',
      external_chat_id: 'external-id',
    });
    const model = Object.assign(new Model(), {
      id: 'alibaba:qwen-plus',
      name: 'qwen-plus',
      provider_id: 6,
      for_image: false,
    });
    fileStorageMock.getFilesByIds.mockResolvedValueOnce([]);
    modelProviderMock.generateStreamResponse.mockResolvedValueOnce(EMPTY);

    await promptService.sendStreamPrompt(chat, model, { input: 'Вопрос' });

    expect(modelProviderMock.generateStreamResponse).toHaveBeenCalledWith(
      model,
      'Вопрос',
      'chat-id',
      { files: [], withSearch: false, withThinking: false },
    );
  });

  it('Передаёт изображения для редактирования и сохраняет только итоговую картинку с вложениями', async () => {
    const chat = Object.assign(new Chat(), {
      id: 'chat-id',
      title: 'Картинка',
      external_chat_id: 'external-id',
    });
    const model = Object.assign(new Model(), {
      name: 'qwen-image-2.0',
      provider_id: 6,
      for_image: true,
    });
    const file = {
      id: 'file-id',
      name: 'input.png',
      mimeType: 'image/png',
      blob: new Blob(['image']),
    };
    fileStorageMock.getFilesByIds.mockResolvedValueOnce([file]);
    modelProviderMock.generateImageResponse.mockResolvedValueOnce(
      of<UnifiedAIStreamChunk[]>(
        { type: 'meta', promptId: 'response-id', inputTokens: 1 },
        {
          type: 'delta',
          promptId: 'response-id',
          content: 'Подготовка',
          index: 0,
          timestamp: new Date(),
          isComplete: false,
        },
        {
          type: 'complete',
          promptId: 'response-id',
          imageB64: 'aW1hZ2U=',
          index: -1,
          timestamp: new Date(),
          isComplete: true,
        },
      ),
    );
    promptRepositoryMock.insert.mockResolvedValueOnce({
      identifiers: [{ id: 'prompt-id' }],
      generatedMaps: [],
      raw: [],
    });

    const stream = await promptService.sendStreamPrompt(chat, model, {
      input: 'Измени фон',
      files_ids: ['file-id'],
    });
    const result = await lastValueFrom(stream);

    expect(modelProviderMock.generateImageResponse).toHaveBeenCalledWith(
      model,
      'Измени фон',
      'external-id',
      { files: [file] },
    );
    expect(promptRepositoryMock.insert).toHaveBeenCalledTimes(1);
    expect(promptRepositoryMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({ is_image: true, response_id: 'response-id' }),
    );
    expect(fileStorageMock.saveGeneratedImage).toHaveBeenCalledWith(
      'prompt-id',
      'chat-id',
      'aW1hZ2U=',
    );
    expect(promptFileRepositoryMock.insert).toHaveBeenCalledWith([
      { file_id: 'file-id', prompt_id: 'prompt-id' },
    ]);
    expect(result.data).toMatchObject({
      promptId: 'prompt-id',
      imageB64: null,
      isComplete: true,
    });
  });
  beforeEach(() => {
    jest.clearAllMocks();
    promptRepositoryMock.createQueryBuilder.mockReturnValue(
      queryBuilder as unknown as SelectQueryBuilder<Prompt>,
    );
  });

  it('Должен возвращать краткий фрагмент текста вокруг найденных слов', async () => {
    queryBuilder.getRawMany.mockResolvedValueOnce([
      {
        id: 'prompt-id',
        preview: 'построить API на <mark>NestJS</mark>',
      },
    ]);

    await expect(
      promptService.searchPrompts('user-id', 'NestJS'),
    ).resolves.toEqual([
      {
        id: 'prompt-id',
        preview: 'построить API на <mark>NestJS</mark>',
      },
    ]);

    expect(queryBuilder.innerJoin).toHaveBeenCalledWith('prompt.chat', 'chat');
    expect(queryBuilder.select).toHaveBeenCalledWith('prompt.id', 'id');
    expect(queryBuilder.addSelect).toHaveBeenCalledWith(
      expect.stringContaining('ts_headline'),
      'preview',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("prompt.response ILIKE :pattern ESCAPE E'\\\\'"),
    );
    expect(queryBuilder.setParameter).toHaveBeenCalledWith('search', 'NestJS');
    expect(queryBuilder.setParameter).toHaveBeenCalledWith(
      'pattern',
      '%NestJS%',
    );
  });
});
