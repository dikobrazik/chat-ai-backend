import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileStorageService {
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      endpoint: configService.get<string>('S3_ENDPOINT'),
      region: configService.get<string>('S3_REGION'),
      credentials: {
        accessKeyId: configService.get<string>('S3_ACCESS_KEY_ID'),
        secretAccessKey: configService.get<string>('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async getPromptImageUrl(chatId: string, promptId: string) {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.configService.get<string>('GENERATED_IMAGES_BUCKET_NAME'),
        Key: `${chatId}/${promptId}.png`,
      }),
      { expiresIn: 120 },
    );
  }

  async saveGeneratedImage(promptId: string, chatId: string, base64: string) {
    const buffer = Buffer.from(base64, 'base64');

    await this.s3Client
      .send(
        new PutObjectCommand({
          Bucket: this.configService.get<string>(
            'GENERATED_IMAGES_BUCKET_NAME',
          ),
          Key: `${chatId}/${promptId}.png`,
          Body: buffer,
        }),
      )
      .catch((err) => {
        console.error('Error uploading file:', err);
      });
  }
}
