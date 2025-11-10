import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Chat = createParamDecorator(
  (data: never, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.chat;
  },
);
