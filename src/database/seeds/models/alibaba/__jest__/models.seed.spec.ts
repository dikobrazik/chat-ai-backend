import {
  ALIBABA_IMAGE_MODELS,
  ALIBABA_TEXT_MODELS,
} from 'src/model-provider/alibaba-models';
import { ALIBABA_MODELS } from '../models.seed';

describe('Каталог моделей Alibaba', () => {
  it('Использует префикс Alibaba для всех моделей и не создаёт дубликаты', () => {
    for (const name of ['qwen-flash', 'qwen-plus', 'kimi-k3']) {
      expect(ALIBABA_MODELS.filter((model) => model.name === name)).toEqual([
        expect.objectContaining({ id: `alibaba:${name}`, provider_id: 6 }),
      ]);
    }
    expect(new Set(ALIBABA_MODELS.map((model) => model.id)).size).toBe(
      ALIBABA_MODELS.length,
    );
  });

  it('Подключает весь описанный каталог к правильной стратегии генерации', () => {
    for (const text of ALIBABA_TEXT_MODELS) {
      expect(
        ALIBABA_MODELS.find((model) => model.name === text.name),
      ).toMatchObject({ for_image: false, provider_id: 6 });
    }
    for (const image of ALIBABA_IMAGE_MODELS) {
      expect(
        ALIBABA_MODELS.find((model) => model.name === image.name),
      ).toMatchObject({ for_image: true, provider_id: 6 });
    }
  });
});
