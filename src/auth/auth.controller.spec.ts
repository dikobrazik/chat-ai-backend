import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { ACCESS_TOKEN_EXPIRES_IN, AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { SessionService } from 'src/session/session.service';
import { UserService } from 'src/user/user.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let sessionService: jest.Mocked<SessionService>;
  let configService: jest.Mocked<ConfigService>;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            createGuest: jest.fn(),
            createSession: jest.fn(),
            generateJwtToken: jest.fn(),
            validateRefreshToken: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            createGuest: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            invalidateSession: jest.fn(),
            updateSessionActivity: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    sessionService = module.get(SessionService);
    configService = module.get(ConfigService);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createGuest', () => {
    it('should create a guest and set cookies', async () => {
      const mockResponse = {
        cookie: jest.fn(),
      } as unknown as Response;

      const mockRequest = {
        cookies: {},
      } as unknown as Request;

      userService.createGuest.mockResolvedValue({ id: 'user-id' } as any);
      authService.createSession.mockResolvedValue({
        deviceId: 'device-id',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await controller.createGuest(mockResponse, mockRequest);

      expect(authService.createSession).toHaveBeenCalledWith(
        { id: 'user-id' },
        mockRequest.clientInfo,
        undefined,
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        },
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'deviceId',
        'device-id',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        },
      );
      expect(result).toBe('access-token');
    });
  });

  describe('loginGoogle', () => {
    it('should be defined', () => {
      expect(controller.loginGoogle).toBeDefined();
    });
  });

  describe('loginYandex', () => {
    it('should be defined', () => {
      expect(controller.loginYandex).toBeDefined();
    });
  });

  describe('authYaRedirect', () => {
    it('should call commonRedirect', async () => {
      const mockRequest = {
        user: { email: 'test@example.com', id: 'user-id' },
        authInfo: {
          deviceId: 'device-id',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      } as unknown as Request;

      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      configService.get.mockReturnValue('http://example.com/redirect');

      await controller.authYaRedirect(mockRequest, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://example.com/redirect?token=access-token&email=test@example.com&id=user-id',
      );
    });
  });

  describe('authGoogleRedirect', () => {
    it('should call commonRedirect', async () => {
      const mockRequest = {
        user: { email: 'test@example.com', id: 'user-id' },
        authInfo: {
          deviceId: 'device-id',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      } as unknown as Request;

      const mockResponse = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      configService.get.mockReturnValue('http://example.com/redirect');

      await controller.authGoogleRedirect(mockRequest, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://example.com/redirect?token=access-token&email=test@example.com&id=user-id',
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token', async () => {
      const mockRequest = {
        cookies: { refreshToken: 'refresh-token', deviceId: 'device-id' },
      } as unknown as Request;

      authService.validateRefreshToken.mockResolvedValue({ userId: 'user-id' });
      authService.generateJwtToken.mockResolvedValue('new-access-token');

      const result = await controller.refreshAccessToken(mockRequest);

      expect(authService.validateRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
        'device-id',
      );
      expect(authService.generateJwtToken).toHaveBeenCalledWith(
        'user-id',
        ACCESS_TOKEN_EXPIRES_IN,
      );
      expect(sessionService.updateSessionActivity).toHaveBeenCalledWith(
        'refresh-token',
      );
      expect(result).toBe('new-access-token');
    });
  });

  describe('logout', () => {
    it('should logout and clear cookies', async () => {
      const mockRequest = {
        cookies: { refreshToken: 'refresh-token', deviceId: 'device-id' },
      } as unknown as Request;

      const mockResponse = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      authService.validateRefreshToken.mockResolvedValue(undefined);
      sessionService.invalidateSession.mockResolvedValue(undefined);

      await controller.logout(mockRequest, mockResponse);

      expect(authService.validateRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
        'device-id',
      );
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(sessionService.invalidateSession).toHaveBeenCalledWith(
        'refresh-token',
        'device-id',
      );
    });
  });
});
