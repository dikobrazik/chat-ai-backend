import {
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ACCESS_TOKEN_EXPIRES_IN, AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { Request, Response } from 'express';
import { SessionService } from 'src/session/session.service';

const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  // path: '/api/auth',
} as const;

@Public()
@Controller('auth')
export class AuthController {
  @Inject(ConfigService)
  private readonly configService: ConfigService;

  @Inject(AuthService)
  private readonly authService: AuthService;
  @Inject(SessionService)
  private readonly sessionService: SessionService;

  @Post('guest')
  async createGuest(@Res({ passthrough: true }) response: Response) {
    const { accessToken, refreshToken } = await this.authService.createGuest();

    response.cookie('refreshToken', refreshToken, SECURE_COOKIE_OPTIONS);

    return accessToken;
  }

  @UseGuards(AuthGuard('google'))
  @Get('google')
  loginGoogle() {}

  @UseGuards(AuthGuard('yandex'))
  @Get('yandex')
  loginYandex() {}

  @Get('ya')
  @UseGuards(AuthGuard('yandex'))
  async authYaRedirect(@Req() request: Request, @Res() response: Response) {
    this.commonRedirect(request, response);
  }

  @Get('g')
  @UseGuards(AuthGuard('google'))
  async authGoogleRedirect(@Req() request: Request, @Res() response: Response) {
    this.commonRedirect(request, response);
  }

  private commonRedirect(request: Request, response: Response) {
    const user = request.user;
    const { deviceId, accessToken, refreshToken } = request.authInfo;

    response.cookie('refreshToken', refreshToken, SECURE_COOKIE_OPTIONS);
    response.cookie('deviceId', deviceId, SECURE_COOKIE_OPTIONS);

    response.redirect(
      this.configService.get('BASE_APP_AUTH_REDIRECT_URL') +
        `?token=${accessToken}&email=${user.email}&id=${user.id}`,
    );
  }

  @Post('refresh')
  async refreshAccessToken(@Req() request: Request) {
    const refreshToken = request.cookies['refreshToken'];
    const deviceId = request.cookies['deviceId'];

    const { userId } = await this.authService.validateRefreshToken(
      refreshToken,
      deviceId,
    );

    this.sessionService.updateSessionActivity(refreshToken);

    const accessToken = await this.authService.generateJwtToken(
      userId,
      ACCESS_TOKEN_EXPIRES_IN,
    );

    return accessToken;
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies['refreshToken'];
    const deviceId = request.cookies['deviceId'];

    await this.authService.validateRefreshToken(refreshToken, deviceId);
    response.clearCookie('refreshToken');
    await this.sessionService.invalidateSession(refreshToken, deviceId);
  }
}
