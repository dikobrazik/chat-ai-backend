import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { UserService } from 'src/user/user.service';
import { AuthService } from './auth.service';
import { SECURE_COOKIE_OPTIONS } from './constants';
import { Public } from './decorators/public.decorator';
import {
  EmailAuthDto,
  PasswordResetDto,
  EmailVerifyDto,
  PasswordResetVerifyDto,
  CheckEmailDto,
} from './dtos';
import { EmailAuthService } from './email-auth.service';
import { PasswordResetService } from './password-reset.service';

@Public()
@Controller('auth/email')
export class EmailAuthController {
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(AuthService)
  private readonly authService: AuthService;
  @Inject(EmailAuthService)
  private readonly emailAuthService: EmailAuthService;
  @Inject(PasswordResetService)
  private readonly passwordResetService: PasswordResetService;

  @Post('sign-in')
  async signIn(
    @Body() body: EmailAuthDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.emailAuthService.validateCredentials(body);

    // если пользователь уже зарегистрирован и email подтвержден, возвращаем accessToken
    if (user.emailVerified) {
      const accessToken = await this.authService.getAccessToken(
        user,
        request,
        response,
      );

      return { accessToken, authCodeSent: false };
    } else {
      await this.emailAuthService.sendAuthCode(body.email);
      return { accessToken: undefined, authCodeSent: true };
    }
  }

  @Post('check-email')
  checkEmail(@Body() body: CheckEmailDto) {
    return this.emailAuthService.isRegisteredEmail(body.email);
  }

  @Post('verify')
  async verify(
    @Body() body: EmailVerifyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.emailAuthService.verifyAuthCode(body.email, body.code);

    const user = await this.userService.findByEmail(body.email);

    const accessToken = await this.authService.getAccessToken(
      user,
      request,
      response,
    );

    return { accessToken };
  }

  @Post('reset')
  async reset(@Body() body: PasswordResetDto) {
    await this.passwordResetService.sendResetPasswordCode(body.email);
  }

  @Post('reset-verify')
  async resetVerify(@Body() body: PasswordResetVerifyDto) {
    await this.passwordResetService.verifyResetPasswordCode(body);
  }
}
