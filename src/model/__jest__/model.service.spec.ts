import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { hours } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestBed, type Mocked } from '@suites/unit';
import { Model } from 'src/entities/Model';
import { ModelProvider } from 'src/entities/ModelProvider';
import { Repository } from 'typeorm';
import { ModelService } from '../model.service';

describe(ModelService.name, () => {
  let modelService: ModelService;
  let repository: Mocked<Repository<Model>>;
  const wrap = jest.fn();
  const repositoryToken = getRepositoryToken(Model) as string;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(ModelService)
      .mock(repositoryToken)
      .impl(() => ({ findOne: jest.fn() }))
      .mock(getRepositoryToken(ModelProvider) as string)
      .impl(() => ({ find: jest.fn() }))
      .mock(CACHE_MANAGER)
      .impl(() => ({ wrap }))
      .compile();

    modelService = unit;
    repository = unitRef.get(repositoryToken);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    wrap.mockImplementation((_key: string, load: () => Promise<Model>) =>
      load(),
    );
  });

  it('Ищет и кэширует модель по полному строковому ID', async () => {
    const model = Object.assign(new Model(), {
      id: 'openai:gpt-5.4',
      name: 'gpt-5.4',
      provider_id: 1,
    });
    repository.findOne.mockResolvedValueOnce(model);

    await expect(modelService.getModel(model.id)).resolves.toBe(model);

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'openai:gpt-5.4' },
    });
    expect(wrap).toHaveBeenCalledWith(
      'model:openai:gpt-5.4',
      expect.any(Function),
      { ttl: hours(6) },
    );
  });
});
