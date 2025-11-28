import { Module } from '@nestjs/common';
import { ModelService } from './model.service';
import { ModelController } from './model.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelProvider } from 'src/entities/ModelProvider';
import { Model } from 'src/entities/Model';

@Module({
  imports: [TypeOrmModule.forFeature([ModelProvider, Model])],
  providers: [ModelService],
  controllers: [ModelController],
  exports: [ModelService],
})
export class ModelModule {}
