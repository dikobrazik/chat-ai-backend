import { BadRequestException } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { AlibabaImageModel } from 'src/model-provider/alibaba-models';
import { InputFile } from 'src/model-provider/model-provider.interface';
import { blobToDataUrl } from 'src/utils/blobToDataUrl';

interface ImageResponse {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    code?: string;
    message?: string;
    task_id?: string;
    task_status?: string;
    choices?: { message?: { content?: { image?: string }[] } }[];
    results?: { url?: string; code?: string; message?: string }[];
  };
}

export class AlibabaImageClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseURL: string,
  ) {}

  async generate(
    model: AlibabaImageModel,
    input: string,
    files: InputFile[],
    signal: AbortSignal,
  ): Promise<{ id: string; imageB64: string }> {
    if (files.some((file) => !file.mimeType.startsWith('image/'))) {
      throw new BadRequestException(
        'Alibaba image models accept only image attachments',
      );
    }
    if (files.length > model.maxImages) {
      throw new BadRequestException(
        `${model.name} accepts at most ${model.maxImages} input images`,
      );
    }
    if (model.requiresImage && !files.length) {
      throw new BadRequestException(`${model.name} requires an input image`);
    }

    const images = await Promise.all(
      files.map((file) => blobToDataUrl(file.blob, file.mimeType)),
    );
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
    }
    const timeout = setTimeout(
      () => controller.abort(new Error('Alibaba image generation timed out')),
      600_000,
    );
    try {
      return await this.generateImage(model, input, images, controller.signal);
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }

  private async generateImage(
    model: AlibabaImageModel,
    input: string,
    images: string[],
    signal: AbortSignal,
  ): Promise<{ id: string; imageB64: string }> {
    const messages = [
      {
        role: 'user',
        content: [...images.map((image) => ({ image })), { text: input }],
      },
    ];
    const asynchronous = model.api !== 'multimodal';
    let path: string;
    let body: object;
    switch (model.api) {
      case 'wan-async':
        path = 'services/aigc/text2image/image-synthesis';
        body = {
          model: model.name,
          input: { prompt: input },
          parameters: { n: 1 },
        };
        break;
      case 'wan-edit-async':
        path = 'services/aigc/image2image/image-synthesis';
        body = {
          model: model.name,
          input: { prompt: input, images },
          parameters: { n: 1 },
        };
        break;
      case 'wan-legacy-edit':
        path = 'services/aigc/image2image/image-synthesis';
        body = {
          model: model.name,
          input: {
            prompt: input,
            base_image_url: images[0],
            function: 'description_edit',
          },
          parameters: { n: 1 },
        };
        break;
      case 'wan-image-async':
        path = 'services/aigc/image-generation/generation';
        body = {
          model: model.name,
          input: { messages },
          parameters: {
            n: 1,
            ...(model.name === 'wan2.6-image'
              ? {
                  enable_interleave: images.length === 0,
                  ...(images.length === 0 ? { max_images: 1 } : {}),
                }
              : {}),
          },
        };
        break;
      case 'multimodal':
        path = 'services/aigc/multimodal-generation/generation';
        body = { model: model.name, input: { messages }, parameters: { n: 1 } };
        break;
    }

    let result = await this.request(path, signal, body, asynchronous);
    const taskId = result.output?.task_id;
    const id = taskId || result.request_id;
    if (asynchronous) {
      if (!taskId) {
        throw new Error('Alibaba image response has no task ID');
      }
      while (result.output?.task_status !== 'SUCCEEDED') {
        const status = result.output?.task_status;
        if (status !== 'PENDING' && status !== 'RUNNING') {
          throw new Error(
            `Alibaba image task ${taskId}: ${
              result.output?.message || status || 'missing task status'
            }`,
          );
        }
        await delay(10_000, undefined, { signal });
        result = await this.request(
          `tasks/${encodeURIComponent(taskId)}`,
          signal,
        );
      }
    }
    if (!id) {
      throw new Error('Alibaba image response has no request ID');
    }
    const imageURL =
      result.output?.choices?.[0]?.message?.content?.find((part) => part.image)
        ?.image || result.output?.results?.find((item) => item.url)?.url;
    if (!imageURL) {
      throw new Error('No image received from Alibaba');
    }
    const url = new URL(imageURL);
    if (url.protocol !== 'https:') {
      throw new Error('Alibaba returned an invalid image URL');
    }
    // Signed result URLs are downloaded without forwarding the Model Studio API key.
    const image = await fetch(url, { signal });
    if (!image.ok) {
      throw new Error(`Alibaba image download failed: HTTP ${image.status}`);
    }
    const contentType = image.headers.get('content-type')?.split(';')[0];
    if (
      !contentType?.startsWith('image/') &&
      contentType !== 'application/octet-stream'
    ) {
      throw new Error('Alibaba image download returned a non-image response');
    }
    const bytes = await image.arrayBuffer();
    if (!bytes.byteLength) {
      throw new Error('Alibaba image download returned an empty image');
    }
    return { id, imageB64: Buffer.from(bytes).toString('base64') };
  }

  private async request(
    path: string,
    signal: AbortSignal,
    body?: object,
    asynchronous = false,
  ): Promise<ImageResponse> {
    const response = await fetch(`${this.baseURL.replace(/\/$/, '')}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(asynchronous ? { 'X-DashScope-Async': 'enable' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal,
    });
    const result: ImageResponse = await response.json();
    if (!result || typeof result !== 'object') {
      throw new Error('Alibaba image API returned an invalid response');
    }
    if (!response.ok || result.code || result.output?.code) {
      throw new Error(
        `Alibaba image API: ${
          result.message ||
          result.output?.message ||
          result.code ||
          `HTTP ${response.status}`
        }`,
      );
    }
    return result;
  }
}
