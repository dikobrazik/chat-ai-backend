import { Injectable, NestMiddleware } from '@nestjs/common';
import { UAParser } from 'ua-parser-js';

@Injectable()
export class UserAgentMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const ua = new UAParser(req.headers['user-agent']);

    req.clientInfo = {
      device: ua.getDevice(), // телефон, планшет, модель
      os: ua.getOS(), // Windows, iOS, Android
      browser: ua.getBrowser(), // Chrome, Safari, Firefox
      engine: ua.getEngine(),
      cpu: ua.getCPU(),
    };

    next();
  }
}
