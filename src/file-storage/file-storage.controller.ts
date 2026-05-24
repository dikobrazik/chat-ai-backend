import {
  Controller,
  Inject,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { FileStorageService } from './file-storage.service';

@Controller('file-storage')
export class FileStorageController {
  @Inject(FileStorageService)
  private readonly fileStorageService: FileStorageService;

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadFiles(
    @User() user: UserEntity,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.fileStorageService.uploadFiles(user.id, files);
  }
}
