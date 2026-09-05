import { Request } from 'express';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Chat = createParamDecorator(
  (data: never, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest() as Request;
    return request.chat;
  },
);
