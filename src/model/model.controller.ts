import { Controller, Get, Inject, UseInterceptors } from '@nestjs/common';
import { ModelService } from './model.service';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { hours } from '@nestjs/throttler';

@Controller('model')
@UseInterceptors(CacheInterceptor)
@CacheTTL(hours(6))
export class ModelController {
  @Inject(ModelService)
  private readonly modelService: ModelService;

  @Get()
  getModels() {
    return this.modelService.getAllModels();
  }
}
