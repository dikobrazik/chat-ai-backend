import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export const OpenAIProvider = {
  provide: 'openai',
  useFactory: (configService: ConfigService) => {
    const openAiApiKey = configService.get<string>('OPEN_AI_API_KEY');
    const proxyIpAddress = configService.get<string>('NGINX_PROXY_IP');

    return new OpenAI({
      baseURL: `http://${proxyIpAddress}/openai/v1`,
      apiKey: openAiApiKey,
    });
  },
  inject: [ConfigService],
};
