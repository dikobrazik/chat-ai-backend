import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { User, UserStatus } from 'src/entities/User';
import { Repository } from 'typeorm';

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
