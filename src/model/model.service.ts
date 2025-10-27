import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Model } from '../entities/Model';
import { Repository } from 'typeorm';
import { ModelProvider } from '../entities/ModelProvider';

@Injectable()
export class ModelService {
  @InjectRepository(Model)
  private readonly modelRepository: Repository<Model>;
  @InjectRepository(ModelProvider)
  private readonly modelProviderRepository: Repository<ModelProvider>;

  public getAllModels() {
    return this.modelProviderRepository.find({ relations: ['models'] });
  }

  public getModel(id: number): Promise<Model> {
    return this.modelRepository.findOne({ where: { id } });
  }
}
