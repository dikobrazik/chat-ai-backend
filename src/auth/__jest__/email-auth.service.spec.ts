import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EmailAuthService } from '../email-auth.service';
import { MailerService } from 'src/mailer/mailer.service';
import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { type Mocked, TestBed } from '@suites/unit';
import {
  EMAIL_STUB,
  DEBUG_EMAIL_STUB,
  PASSWORD_STUB,
  USER_STUB,
} from './stubs';
import { Cache } from 'cache-manager';

describe(EmailAuthService.name, () => {
  let emailAuthService: EmailAuthService;
  let userServiceMock: Mocked<UserService>;
  let mailerServiceMock: Mocked<MailerService>;
  let cacheManagerMock: Mocked<Cache>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(EmailAuthService)
      .mock(ConfigService)
      .final({ get: jest.fn(() => '@tridva.ru') })
      .mock(UserService)
      .impl(() => ({ findByEmail: jest.fn(), saveUser: jest.fn() }))
      .mock(MailerService)
      .impl(() => ({ sendAuthCode: jest.fn() }))
      .mock(CACHE_MANAGER)
      .impl(() => ({ set: jest.fn(), get: jest.fn() }))
      .compile();

    emailAuthService = unit;
    userServiceMock = unitRef.get(UserService);
    mailerServiceMock = unitRef.get(MailerService);
    cacheManagerMock = unitRef.get(CACHE_MANAGER);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCredentials', () => {
    describe('Если пользователь новый', () => {
      beforeEach(() => {
        userServiceMock.findByEmail.mockReturnValueOnce(undefined);
      });

      it('Должен создать нового пользователя с переданными email и password', async () => {
        await emailAuthService.validateCredentials({
          email: EMAIL_STUB,
          password: PASSWORD_STUB,
        });

        expect(userServiceMock.saveUser).toHaveBeenCalledWith({
          email: EMAIL_STUB,
          passwordHash: expect.any(String),
          status: 'active',
        });
      });
    });

    describe('Если пользователь существующий', () => {
      describe('Если email привязан к пользователю с паролем', () => {
        describe('Если пароль совпадает', () => {
          beforeEach(() => {
            userServiceMock.findByEmail.mockResolvedValueOnce(USER_STUB);
          });
          it('Должен вернуть пользователя', async () => {
            const user = await emailAuthService.validateCredentials({
              email: EMAIL_STUB,
              password: PASSWORD_STUB,
            });

            expect(user).toEqual(USER_STUB);
          });
        });

        describe('Если пароль не совпадает', () => {
          beforeEach(() => {
            userServiceMock.findByEmail.mockResolvedValueOnce(USER_STUB);
          });

          it('Должен вызвать ошибку', async () => {
            expect(() =>
              emailAuthService.validateCredentials({
                email: EMAIL_STUB,
                password: '123',
              }),
            ).rejects.toMatchSnapshot();
          });
        });
      });

      describe('Если email привязан к пользователю без пароля', () => {
        beforeEach(() => {
          userServiceMock.findByEmail.mockResolvedValueOnce({
            ...USER_STUB,
            passwordHash: null,
          });
        });

        it('Должен вызвать ошибку', async () => {
          expect(() =>
            emailAuthService.validateCredentials({
              email: EMAIL_STUB,
              password: '123',
            }),
          ).rejects.toMatchSnapshot();
        });
      });
    });
  });

  describe('sendAuthCode', () => {
    describe('Если email является debug email', () => {
      it('Должен не отправлять код', async () => {
        await emailAuthService.sendAuthCode(DEBUG_EMAIL_STUB);

        expect(mailerServiceMock.sendAuthCode).not.toHaveBeenCalled();
      });
    });
    describe('Если email не является debug email', () => {
      it('Должен отправлять код', async () => {
        await emailAuthService.sendAuthCode(EMAIL_STUB);

        expect(mailerServiceMock.sendAuthCode).toHaveBeenCalledWith(
          EMAIL_STUB,
          expect.any(String),
        );
      });

      it('Должен положить код в кэш', async () => {
        await emailAuthService.sendAuthCode(EMAIL_STUB);

        expect(cacheManagerMock.set).toHaveBeenCalledWith(
          expect.stringContaining(EMAIL_STUB),
          expect.stringMatching(/^\d{6}$/),
          300_000,
        );
      });
    });
  });

  describe('verifyAuthCode', () => {
    describe('Если email является debug email', () => {
      it('Должен вернуть true', async () => {
        const result = await emailAuthService.verifyAuthCode(
          DEBUG_EMAIL_STUB,
          '123456',
        );

        expect(result).toBe(true);
      });
    });

    describe('Если email не является debug email', () => {
      it('Должен вернуть true, если код совпадает', async () => {
        cacheManagerMock.get.mockResolvedValueOnce('123456');

        const result = await emailAuthService.verifyAuthCode(
          EMAIL_STUB,
          '123456',
        );

        expect(result).toBe(true);
      });

      it('Должен вызвать ошибку, если кода нет в кэше', async () => {
        cacheManagerMock.get.mockResolvedValueOnce(null);

        expect(() =>
          emailAuthService.verifyAuthCode(EMAIL_STUB, '654321'),
        ).rejects.toMatchSnapshot();
      });

      it('Должен вызвать ошибку, если код не совпадает', async () => {
        cacheManagerMock.get.mockResolvedValueOnce('123456');

        expect(() =>
          emailAuthService.verifyAuthCode(EMAIL_STUB, '654321'),
        ).rejects.toMatchSnapshot();
      });

      it('Должен удалить код из кэша после успешной проверки', async () => {
        cacheManagerMock.get.mockResolvedValueOnce('123456');

        await emailAuthService.verifyAuthCode(EMAIL_STUB, '123456');

        expect(cacheManagerMock.del).toHaveBeenCalledWith(
          expect.stringContaining(EMAIL_STUB),
        );
      });

      it('Должен обновить статус пользователя на VERIFIED после успешной проверки', async () => {
        cacheManagerMock.get.mockResolvedValueOnce('123456');

        await emailAuthService.verifyAuthCode(EMAIL_STUB, '123456');

        expect(userServiceMock.saveUser).toHaveBeenCalledWith({
          email: EMAIL_STUB,
          status: 'verified',
          emailVerified: true,
        });
      });
    });
  });
});
