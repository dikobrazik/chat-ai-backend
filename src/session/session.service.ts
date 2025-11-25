import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Session } from 'src/entities/Session';
import { generateHash } from 'src/utils/generateHash';
import { Repository } from 'typeorm';

@Injectable()
export class SessionService {
  @InjectRepository(Session)
  private readonly sessionRepository: Repository<Session>;

  public async createSession(
    userId: string,
    clientInfo: Request['clientInfo'],
    deviceId: string,
    refreshToken: string,
  ) {
    await this.sessionRepository.upsert(
      {
        user_id: userId,
        os: `${clientInfo.os.name} ${clientInfo.os.version}`,
        browser: `${clientInfo.browser.name} ${clientInfo.browser.version}`,
        device_id: deviceId,
        location: '', // TODO: implement location detection
        refresh_token_hash: generateHash(refreshToken),
        last_active_at: new Date(),
        expires_at: new Date().toJSON(),
        revoked: false,
      },
      // если устройство у пользователя уже есть - обновляем сессию на этом устройстве,
      // иначе создаём новую
      ['user_id', 'device_id'],
    );
  }

  public async updateSessionActivity(refreshToken: string) {
    await this.sessionRepository.update(
      {
        refresh_token_hash: generateHash(refreshToken),
      },
      {
        last_active_at: new Date(),
      },
    );
  }

  public async getSession(token: string, deviceId: string) {
    return this.sessionRepository.findOne({
      where: {
        refresh_token_hash: generateHash(token),
        device_id: deviceId,
      },
    });
  }

  public async invalidateSession(token: string, deviceId: string) {
    await this.sessionRepository.delete({
      refresh_token_hash: generateHash(token),
      device_id: deviceId,
    });
  }
}
