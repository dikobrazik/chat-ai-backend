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
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  @Inject(ConfigService)
  private readonly configService: ConfigService;

  @Inject(AuthService)
  private readonly authService: AuthService;

  @Post('guest')
  async createGuest() {
    const { token } = await this.authService.createGuest();
    return token;
  }

  @UseGuards(AuthGuard('google'))
  @Get('google')
  loginGoogle() {}

  @UseGuards(AuthGuard('yandex'))
  @Get('yandex')
  loginYandex() {}

  @Get('ya')
  @UseGuards(AuthGuard('yandex'))
  async authYaRedirect(@Req() request, @Res() res) {
    const { user, token } = request.user;
    res.redirect(
      this.configService.get('BASE_APP_URL') +
        `/auth/callback?token=${token}&email=${user.email}&id=${user.id}&source=ya`,
    );
  }

  @Get('g')
  @UseGuards(AuthGuard('google'))
  async authGoogleRedirect(@Req() request, @Res({ passthrough: true }) res) {
    const { user, token } = request.user;

    res.redirect(
      this.configService.get('BASE_APP_URL') +
        `/auth/callback?token=${token}&email=${user.email}&id=${user.id}`,
    );
  }
}
