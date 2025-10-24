import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';

export const GoogleGenAIProvider = {
  provide: 'google-genai',
  useFactory: (configService: ConfigService) => {
    const googleApiKey = configService.get<string>('GOOGLE_API_KEY');
    const proxyIpAddress = configService.get<string>('NGINX_PROXY_IP');

    return new GoogleGenAI({
      httpOptions: {
        baseUrl: `http://${proxyIpAddress}/google`,
      },
      apiKey: googleApiKey,
    });
  },
  inject: [ConfigService],
};
