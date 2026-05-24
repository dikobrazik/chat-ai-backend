import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { FileStorageController } from './file-storage.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from 'src/entities/File';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  providers: [FileStorageService],
  controllers: [FileStorageController],
  exports: [FileStorageService],
})
export class FileStorageModule {}
