import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateChatDTO } from '../dto';

describe('Создание чата со строковым ID модели', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });

  it('Принимает строковый ID и не изменяет его', async () => {
    await expect(
      pipe.transform(
        { model_id: 'openai:gpt-5.4' },
        { type: 'body', metatype: CreateChatDTO },
      ),
    ).resolves.toEqual({ model_id: 'openai:gpt-5.4' });
  });

  it.each([42, '', null, undefined, {}])(
    'Отклоняет некорректный ID модели %p',
    async (modelId) => {
      await expect(
        pipe.transform(
          { model_id: modelId },
          { type: 'body', metatype: CreateChatDTO },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
