import {
  Body,
  Controller,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';
import { WebhookNotification } from './types';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  @Inject(WebhookService)
  private readonly webhookService: WebhookService;

  @Public()
  @Post('/notify')
  async notification(
    @Body() body: WebhookNotification,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.statusCode = HttpStatus.OK;

    await this.webhookService.processNotification(body);

    return 'OK';
  }
}
