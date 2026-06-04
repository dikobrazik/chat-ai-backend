import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { UserService } from 'src/user/user.service';
import { AuthService } from './auth.service';
import { SECURE_COOKIE_OPTIONS } from './constants';
import { Public } from './decorators/public.decorator';
import { EmailAuthDto, EmailVerifyDto } from './dtos';
import { EmailAuthService } from './email-auth.service';

@Public()
@Controller('auth/email')
export class EmailAuthController {
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(AuthService)
  private readonly authService: AuthService;
  @Inject(EmailAuthService)
  private readonly emailAuthService: EmailAuthService;

  @Post('sign-in')
  async signIn(@Body() body: EmailAuthDto) {
    await this.emailAuthService.createUser(body);

    await this.emailAuthService.sendAuthCode(body.email);
  }

  @Post('verify')
  async verify(
    @Body() body: EmailVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.emailAuthService.verifyAuthCode(body.email, body.code);

    const user = await this.userService.createUser({
      email: body.email,
      emailVerified: true,
    });

    const requestDeviceId = request.cookies['deviceId'];

    const { deviceId, accessToken, refreshToken } =
      await this.authService.createSession(
        user,
        request.clientInfo,
        requestDeviceId,
      );

    response.cookie('refreshToken', refreshToken, SECURE_COOKIE_OPTIONS);
    response.cookie('deviceId', deviceId, SECURE_COOKIE_OPTIONS);

    return accessToken;
  }
}
