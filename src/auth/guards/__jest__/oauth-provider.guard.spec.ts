import {
  BadRequestException,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard, type IAuthGuard } from '@nestjs/passport';
import { OauthProviderGuard } from '../oauth-provider.guard';

jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn(),
}));

const createContext = (
  provider: string,
  query: Record<string, string> = {},
) => {
  const request = { params: { provider }, query, session: {} };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
};

describe(OauthProviderGuard.name, () => {
  const canActivate = jest.fn();
  const authGuardMock = jest.mocked(AuthGuard);
  let guard: OauthProviderGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new OauthProviderGuard();
    authGuardMock.mockReturnValue(
      class implements IAuthGuard {
        canActivate = canActivate;

        async logIn(_request: any): Promise<void> {}

        handleRequest<TUser = any>(
          _err: any,
          user: any,
          _info: any,
          _context: ExecutionContext,
          _status?: any,
        ): TUser {
          return user;
        }

        getAuthenticateOptions(_context: ExecutionContext) {
          return undefined;
        }

        getRequest(_context: ExecutionContext) {
          return undefined;
        }
      },
    );
    canActivate.mockResolvedValue(true);
  });

  it.each([
    ['google', 'google'],
    ['yandex', 'yandex'],
    ['vkontakte', 'vk'],
    ['mailru', 'mailru'],
    ['odnoklassniki', 'ok'],
  ])(
    'Должен запускать стратегию %s для OAuth-провайдера %s',
    async (strategy, provider) => {
      const context = createContext(provider);

      await expect(guard.canActivate(context)).resolves.toBe(true);

      expect(authGuardMock).toHaveBeenCalledWith(strategy);
      expect(canActivate).toHaveBeenCalledWith(context);
    },
  );

  it('Должен отклонять неизвестного OAuth-провайдера', () => {
    expect(() => guard.canActivate(createContext('unknown'))).toThrow(
      new NotFoundException('OAuth provider not found'),
    );
    expect(authGuardMock).not.toHaveBeenCalled();
  });

  it('Должен сохранить явное согласие на рассылку в OAuth-сессии', async () => {
    const context = createContext('google', { mailing_consent: '1' });
    const request = context.switchToHttp().getRequest();

    await guard.canActivate(context);

    expect(request.session.mailingConsent).toBe(true);
  });

  it('Должен отклонять некорректное согласие на рассылку', () => {
    expect(() =>
      guard.canActivate(createContext('google', { mailing_consent: 'true' })),
    ).toThrow(
      new BadRequestException('mailing_consent must be "1" when provided'),
    );
  });
});
