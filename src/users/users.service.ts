import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserStatus } from '../entities/User';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;

  public createGuest() {
    return this.userRepository.save({});
  }

  public async createOrGetUser(email: string, name: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (user) return user;

    return this.userRepository.save({ email, name, status: UserStatus.ACTIVE });
  }

  public findById(userId: string) {
    return this.userRepository.findOne({ where: { id: userId } });
  }
}
