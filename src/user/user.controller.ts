import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  ValidationPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { PatchUserDto } from 'src/user/dto';

@Controller('user')
export class UserController {
  @Inject(UserService)
  private readonly userService: UserService;

  @Get('profile')
  getProfile(@User() user: UserEntity) {
    return this.userService.findById(user.id);
  }

  @Patch('profile')
  patchProfile(
    @User() user: UserEntity,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    body: PatchUserDto,
  ) {
    return this.userService.updateProfile(user.id, body);
  }
}
