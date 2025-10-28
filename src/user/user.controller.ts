import { Controller, Get, Inject } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../decorators/user.decorator';
import { User as UserEntity } from '../entities/User';

@Controller('user')
export class UserController {
  @Inject(UserService)
  private readonly userService: UserService;

  @Get('profile')
  getProfile(@User() user: UserEntity) {
    return this.userService.findById(user.id);
  }
}
