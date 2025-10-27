import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { YandexStrategy } from './strategies/yandex.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { HttpModule } from '@nestjs/axios';
import { UserModule } from '../user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../entities/Session';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    HttpModule,
    UserModule,
    TypeOrmModule.forFeature([Session]),
  ],
  providers: [AuthService, YandexStrategy, GoogleStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
