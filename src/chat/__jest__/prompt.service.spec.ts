import { TestBed, type Mocked } from '@suites/unit';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { ModelProviderService } from 'src/model-provider/model-provider.service';
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
      .impl(() => ({}))
      .mock(ChatTitleGeneratorService)
      .impl(() => ({}))
      .mock(FileStorageService)
      .impl(() => ({}))
      .mock(promptRepositoryToken)
      .impl(() => ({ createQueryBuilder: jest.fn() }))
      .mock(getRepositoryToken(PromptFile) as string)
      .impl(() => ({}))
      .mock(getRepositoryToken(PromptMeta) as string)
      .impl(() => ({}))
      .compile();

    promptService = unit;
    promptRepositoryMock = unitRef.get(promptRepositoryToken);
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
