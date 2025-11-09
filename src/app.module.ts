import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from './entities/User';
import { Session } from './entities/Session';
import { ChatModule } from './chat/chat.module';
import { Chat } from './entities/Chat';
import { Prompt } from './entities/Prompt';
import { ThrottlerModule, days, hours } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { AppThrottlerGuard } from './guards/prompt.guard';
import { ChatController } from './chat/chat.controller';
import { ModelProvider } from './entities/ModelProvider';
import { Model } from './entities/Model';
import { ModelModule } from './model/model.module';
import { ModelProviderModule } from './model-provider/model-provider.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { Payment } from './entities/Payment';
import { Subscription } from './entities/Subscription';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      global: true,
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('JWT_SECRET'),
        // signOptions: { expiresIn: '7d' },
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow('DB_HOST'),
        port: configService.getOrThrow('DB_PORT'),
        username: configService.getOrThrow('DB_USERNAME'),
        password: configService.getOrThrow('DB_PASS'),
        database: configService.getOrThrow('DB_NAME'),
        ssl: {
          ca: readFileSync(join(cwd(), 'db.pem')),
        },
        synchronize: true,
        dropSchema: false,
        logging: configService.get('IS_DEV') === 'true',
        entities: [
          Chat,
          Prompt,
          User,
          Session,
          ModelProvider,
          Model,
          Payment,
          Subscription,
        ],
        subscribers: [],
        migrations: [],
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    ChatModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: hours(1),
        limit: 1000,
      },
      {
        name: 'prompt',
        ttl: days(1),
        limit: 1,
        skipIf: (context) => {
          return (
            context.getHandler().name !==
            ChatController.prototype.createPrompt.name
          );
        },
      },
    ]),
    ModelModule,
    ModelProviderModule,
    SubscriptionModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Используем кастомный Guard
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard, // Используем кастомный Guard
    },
  ],
})
export class AppModule {}
