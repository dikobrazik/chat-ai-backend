import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { hours } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Model } from 'src/entities/Model';
import { ModelProvider } from 'src/entities/ModelProvider';
import { Repository } from 'typeorm';

@Injectable()
export class ModelService {
  @InjectRepository(Model)
  private readonly modelRepository: Repository<Model>;
  @InjectRepository(ModelProvider)
  private readonly modelProviderRepository: Repository<ModelProvider>;
  @Inject(CACHE_MANAGER)
  private cacheManager: Cache;

  public getAllModels() {
    return this.modelProviderRepository.find({ relations: ['models'] });
  }

  public getModel(id: number): Promise<Model> {
    return this.cacheManager.wrap(
      `model:${id}`,
      () => this.modelRepository.findOne({ where: { id } }),
      { ttl: hours(6) },
    );
  }
}
