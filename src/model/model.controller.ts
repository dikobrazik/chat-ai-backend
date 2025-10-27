import { Controller, Get, Inject } from '@nestjs/common';
import { ModelService } from './model.service';

@Controller('model')
export class ModelController {
  @Inject(ModelService)
  private readonly modelService: ModelService;

  @Get()
  getModels() {
    return this.modelService.getAllModels();
  }
}
