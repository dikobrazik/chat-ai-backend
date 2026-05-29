import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from 'src/entities/User';
import { FileStorageService } from 'src/file-storage/file-storage.service';
import { PromptDTO } from '../dto';

@Injectable()
export class PromptGuard implements CanActivate {
  @Inject(FileStorageService)
  private fileStorageService: FileStorageService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const { files_ids } = request.query as unknown as PromptDTO;
    const user = request.user as User;

    return Promise.all(
      files_ids.map((fileId) =>
        this.fileStorageService.checkIsFileOwner(fileId, user.id),
      ),
    ).then((result) => result.every(Boolean));
  }
}
