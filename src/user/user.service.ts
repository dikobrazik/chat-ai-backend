import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { User, UserStatus } from 'src/entities/User';
import { PatchUserDto } from 'src/user/dto';
import { QueryFailedError, Repository } from 'typeorm';

@Injectable()
export class UserService {
  @InjectRepository(User)
  private readonly userRepository: Repository<User>;
  @Inject(CACHE_MANAGER)
  private cacheManager: Cache;

  public createGuest() {
    return this.userRepository.save({});
  }

  public async saveUser({
    email,
    name,
    photo,
    passwordHash,
    emailVerified,
    status,
    mailing_consent: mailingConsent,
  }: Pick<User, 'email'> &
    Partial<
      Pick<
        User,
        | 'name'
        | 'photo'
        | 'passwordHash'
        | 'emailVerified'
        | 'status'
        | 'mailing_consent'
      >
    >) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (user) {
      await this.userRepository.save({
        id: user.id,
        email,
        name,
        photo,
        passwordHash,
        emailVerified,
        status,
        mailing_consent: user.mailing_consent || mailingConsent,
      });

      return user;
    }

    return this.userRepository.save({
      email,
      name,
      photo,
      passwordHash,
      emailVerified,
      mailing_consent: mailingConsent ?? false,
      status: emailVerified ? UserStatus.VERIFIED : UserStatus.ACTIVE,
    });
  }

  public enableMailingConsent(userId: string) {
    return this.userRepository.update(userId, { mailing_consent: true });
  }

  public async updateProfile(
    userId: string,
    { name, mailing_consent }: PatchUserDto,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const changes: Partial<User> = {};
    if (name !== undefined) changes.name = name;
    if (mailing_consent !== undefined)
      changes.mailing_consent = mailing_consent;

    if (Object.keys(changes).length === 0) return user;

    try {
      const result = await this.userRepository.update(userId, changes);
      if (!result.affected) {
        throw new NotFoundException('User not found');
      }
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        'code' in error.driverError &&
        error.driverError.code === '23505'
      ) {
        throw new ConflictException('Email is already in use');
      }
      throw error;
    }

    await this.cacheManager.del(`user:${userId}`);
    return this.findById(userId);
  }

  public async resetSubscription(userId: string) {
    const user = await this.findById(userId);

    await this.userRepository.update(userId, {
      status: user.emailVerified ? UserStatus.VERIFIED : UserStatus.ACTIVE,
    });
  }

  public findById(userId: string) {
    // тут надо быть осторожным, так как может съесть всю память
    return this.cacheManager.wrap(
      `user:${userId}`,
      () => this.userRepository.findOne({ where: { id: userId } }),
      { ttl: 10_000 },
    );
  }

  public findByEmail(email: string): Promise<User | undefined> {
    return this.userRepository.findOne({ where: { email } });
  }
}
