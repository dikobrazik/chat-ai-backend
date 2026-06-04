import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { YandexStrategy } from './strategies/yandex.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { HttpModule } from '@nestjs/axios';
import { UserModule } from 'src/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OauthAccount } from 'src/entities/OauthAccount';
import { SessionModule } from 'src/session/session.module';
import { EmailAuthController } from './email-auth.controller';
import { MailerService } from 'src/mailer/mailer.service';
import { EmailAuthService } from './email-auth.service';

@Module({
  imports: [
    SessionModule,
    PassportModule,
    HttpModule,
    UserModule,
    TypeOrmModule.forFeature([OauthAccount]),
  ],
  providers: [
    AuthService,
    YandexStrategy,
    GoogleStrategy,
    JwtStrategy,
    MailerService,
    EmailAuthService,
  ],
  controllers: [AuthController, EmailAuthController],
})
export class AuthModule {}
