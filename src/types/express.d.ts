// src/types/express.d.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

declare module 'express' {
  interface Request {
    authInfo?: {
      deviceId: string;
      accessToken: string;
      refreshToken: string;
    };
    user?: import('../../entities/User').User;
    chat?: import('../../entities/Chat').Chat;
    chatModel?: import('../../entities/Model').Model;
    clientInfo: {
      device: UAParser.IResult['device'];
      os: UAParser.IResult['os'];
      browser: UAParser.IResult['browser'];
      engine: UAParser.IResult['engine'];
      cpu: UAParser.IResult['cpu'];
    };
  }
}
