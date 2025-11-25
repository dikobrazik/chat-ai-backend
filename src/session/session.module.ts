import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from 'src/entities/Session';

@Module({
  providers: [SessionService],
  imports: [TypeOrmModule.forFeature([Session])],
  controllers: [SessionController],
  exports: [SessionService],
})
export class SessionModule {}
