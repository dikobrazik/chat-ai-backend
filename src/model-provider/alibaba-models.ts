import { UserStatus } from 'src/entities/User';

export interface AlibabaTextModel {
  name: string;
  description: string;
  thinking?: 'optional' | 'always' | 'effort';
  search?: 'chat' | 'responses';
  vision?: boolean;
  omni?: boolean;
  status?: UserStatus;
}

export interface AlibabaImageModel {
  name: string;
  description: string;
  api:
    | 'multimodal'
    | 'wan-async'
    | 'wan-image-async'
    | 'wan-edit-async'
    | 'wan-legacy-edit';
  maxImages: number;
  requiresImage?: boolean;
}

const multimodal = {
  thinking: 'optional',
  vision: true,
  search: 'responses',
} as const;

// Model IDs and capabilities are from Model Studio's text, vision and image catalogs.
export const ALIBABA_TEXT_MODELS: AlibabaTextModel[] = [
  {
    name: 'qwen3.8-max',
    description: 'Флагманская модель Qwen 3.8',
    ...multimodal,
    status: UserStatus.SUBSCRIPTION_PRO,
  },
  {
    name: 'qwen3.8-max-0902',
    description: 'Qwen 3.8 Max (09-02)',
    ...multimodal,
    status: UserStatus.SUBSCRIPTION_PRO,
  },
  {
    name: 'qwen3.8-flash',
    description: 'Быстрая мультимодальная модель Qwen 3.8',
    ...multimodal,
  },
  {
    name: 'qwen3.8-27b',
    description: 'Открытая модель Qwen 3.8 27B',
    thinking: 'optional',
  },
  {
    name: 'qwen3.8-2.4t-a95b',
    description: 'Открытая reasoning-модель Qwen 3.8',
    thinking: 'always',
  },
  {
    name: 'qwen3.8-omni-flash',
    description: 'Мультимодальная модель Qwen 3.8 Omni (текст и изображения)',
    vision: true,
    thinking: 'effort',
    search: 'responses',
    omni: true,
  },
  {
    name: 'qwen3.7-max',
    description: 'Модель Qwen 3.7 Max',
    ...multimodal,
    status: UserStatus.SUBSCRIPTION_PRO,
  },
  {
    name: 'qwen3.7-max-2026-06-08',
    description: 'Qwen 3.7 Max (2026-06-08)',
    ...multimodal,
    status: UserStatus.SUBSCRIPTION_PRO,
  },
  {
    name: 'qwen3.7-max-2026-05-20',
    description: 'Qwen 3.7 Max (2026-05-20)',
    thinking: 'optional',
    search: 'responses',
  },
  {
    name: 'qwen3.7-max-preview',
    description: 'Предварительная reasoning-модель Qwen 3.7 Max',
    thinking: 'always',
  },
  {
    name: 'qwen3.7-max-2026-05-17',
    description: 'Reasoning-модель Qwen 3.7 Max (2026-05-17)',
    thinking: 'always',
  },
  {
    name: 'qwen3.7-plus',
    description: 'Универсальная модель Qwen 3.7 Plus',
    ...multimodal,
  },
  {
    name: 'qwen3.7-plus-2026-05-26',
    description: 'Qwen 3.7 Plus (2026-05-26)',
    ...multimodal,
  },
  {
    name: 'qwen3.7-flash',
    description: 'Быстрая модель Qwen 3.7 Flash',
    ...multimodal,
  },
  {
    name: 'qwen3.7-flash-2026-07-15',
    description: 'Qwen 3.7 Flash (2026-07-15)',
    ...multimodal,
  },
  {
    name: 'qwen3.6-plus',
    description: 'Универсальная модель Qwen 3.6 Plus',
    ...multimodal,
  },
  {
    name: 'qwen3.6-plus-2026-04-02',
    description: 'Qwen 3.6 Plus (2026-04-02)',
    ...multimodal,
  },
  {
    name: 'qwen3.6-flash',
    description: 'Быстрая модель Qwen 3.6 Flash',
    ...multimodal,
  },
  {
    name: 'qwen3.6-flash-2026-04-16',
    description: 'Qwen 3.6 Flash (2026-04-16)',
    ...multimodal,
  },
  {
    name: 'qwen3.6-27b',
    description: 'Открытая модель Qwen 3.6 27B',
    thinking: 'optional',
  },
  {
    name: 'qwen3.6-35b-a3b',
    description: 'Открытая мультимодальная модель Qwen 3.6',
    vision: true,
    thinking: 'optional',
  },
  {
    name: 'qwen3.5-plus',
    description: 'Универсальная модель Qwen 3.5 Plus',
    ...multimodal,
  },
  {
    name: 'qwen3.5-plus-2026-04-20',
    description: 'Qwen 3.5 Plus (2026-04-20)',
    ...multimodal,
  },
  {
    name: 'qwen3.5-plus-2026-02-15',
    description: 'Qwen 3.5 Plus (2026-02-15)',
    ...multimodal,
  },
  {
    name: 'qwen3.5-flash',
    description: 'Быстрая модель Qwen 3.5 Flash',
    ...multimodal,
  },
  {
    name: 'qwen3.5-flash-2026-02-23',
    description: 'Qwen 3.5 Flash (2026-02-23)',
    ...multimodal,
  },
  ...[
    'qwen3.5-397b-a17b',
    'qwen3.5-122b-a10b',
    'qwen3.5-27b',
    'qwen3.5-35b-a3b',
  ].map(
    (name): AlibabaTextModel => ({
      name,
      description: `Открытая мультимодальная модель ${name}`,
      vision: true,
      thinking: 'optional',
    }),
  ),
  {
    name: 'qwen3-coder-flash',
    description: 'Модель Qwen для программирования',
  },
  {
    name: 'qwen3-coder-flash-2025-07-28',
    description: 'Qwen Coder Flash (2025-07-28)',
  },
  {
    name: 'qwen-plus',
    description: 'Модель Qwen для анализа и сложных задач',
    thinking: 'optional',
    search: 'chat',
  },
  {
    name: 'qwen-plus-latest',
    description: 'Последняя версия Qwen Plus',
    thinking: 'optional',
    search: 'chat',
  },
  {
    name: 'qwen-max',
    description: 'Модель Qwen Max',
    search: 'chat',
    status: UserStatus.SUBSCRIPTION_PRO,
  },
  {
    name: 'qwen-flash',
    description: 'Быстрая модель Qwen для повседневных задач',
    thinking: 'optional',
    search: 'chat',
    status: UserStatus.GUEST,
  },
  { name: 'qwen-long', description: 'Модель Qwen для длинных текстов' },
  {
    name: 'qwen-plus-character',
    description: 'Модель Qwen для ролевых диалогов',
    search: 'chat',
  },
  {
    name: 'qwen-plus-character-ja',
    description: 'Модель Qwen для ролевых диалогов на японском',
  },
  {
    name: 'qwen-flash-character',
    description: 'Быстрая модель Qwen для ролевых диалогов',
    search: 'chat',
  },
  {
    name: 'qwen3-vl-plus',
    description: 'Модель Qwen VL для понимания изображений',
    vision: true,
    thinking: 'optional',
  },
  {
    name: 'qwen-vl-ocr',
    description: 'Модель Qwen для распознавания текста на изображениях',
    vision: true,
  },
  {
    name: 'qwen3.5-ocr',
    description: 'Модель Qwen 3.5 для распознавания документов',
    vision: true,
  },
  {
    name: 'qwen3-omni-flash',
    description: 'Мультимодальная модель Qwen 3 Omni (текст и изображения)',
    vision: true,
    omni: true,
  },
  {
    name: 'qwen3.5-omni-plus',
    description:
      'Мультимодальная модель Qwen 3.5 Omni Plus (текст и изображения)',
    vision: true,
    omni: true,
  },
  {
    name: 'qwen3.5-omni-flash',
    description:
      'Мультимодальная модель Qwen 3.5 Omni Flash (текст и изображения)',
    vision: true,
    omni: true,
  },
  // Third-party models are served by Alibaba, independently of native providers.
  { name: 'kimi-k3', description: 'Kimi K3 через Alibaba', thinking: 'always' },
  {
    name: 'kimi-k2.7-code',
    description: 'Kimi K2.7 Code через Alibaba',
    thinking: 'always',
    search: 'chat',
  },
  {
    name: 'kimi-k2.6',
    description: 'Kimi K2.6 через Alibaba',
    thinking: 'optional',
  },
  {
    name: 'kimi-k2.5',
    description: 'Kimi K2.5 через Alibaba',
    thinking: 'optional',
    vision: true,
  },
  {
    name: 'deepseek-v4.1-flash-1017',
    description: 'DeepSeek V4.1 Flash через Alibaba',
    thinking: 'optional',
    search: 'chat',
  },
  {
    name: 'deepseek-v4-pro',
    description: 'DeepSeek V4 Pro через Alibaba',
    thinking: 'optional',
    search: 'chat',
  },
  ...[
    'deepseek-v4.1-flash',
    'deepseek-v4-pro-0813',
    'deepseek-v4-flash-0731',
  ].map(
    (name): AlibabaTextModel => ({
      name,
      description: `${name} через Alibaba`,
      thinking: 'optional',
      search: 'responses',
    }),
  ),
  ...[
    'glm-5.3',
    'glm-5.2',
    'glm-5.1',
    'glm-5',
    'MiniMax-M3.1-Flash',
    'MiniMax-M3',
    'MiniMax-M2.7',
    'MiniMax-M2.5',
    'mimo-v2.6-pro-ultraspeed',
    'mimo-v2.5-pro',
    'step-5-preview',
    'step-3.7-flash',
    'deepseek-r1-distill-qwen-1.5b',
  ].map(
    (name): AlibabaTextModel => ({
      name,
      description: `${name} через Alibaba`,
      thinking: 'always',
    }),
  ),
  {
    name: 'glm-5.2-fast-preview',
    description: 'GLM 5.2 Fast Preview через Alibaba',
    thinking: 'always',
    search: 'chat',
  },
];

export const ALIBABA_IMAGE_MODELS: AlibabaImageModel[] = [
  ...[
    'qwen-image-3.0-pro',
    'qwen-image-3.0',
    'qwen-image-2.0-pro',
    'qwen-image-2.0-pro-2026-06-22',
    'qwen-image-2.0-pro-2026-04-22',
    'qwen-image-2.0-pro-2026-03-03',
    'qwen-image-2.0',
    'qwen-image-2.0-2026-03-03',
  ].map(
    (name): AlibabaImageModel => ({
      name,
      description: `Генерация и редактирование изображений ${name}`,
      api: 'multimodal',
      maxImages: 3,
    }),
  ),
  ...['qwen-image-2.1-pro', 'qwen-image-2.1-turbo'].map(
    (name): AlibabaImageModel => ({
      name,
      description: `Генерация и редактирование изображений ${name}`,
      api: 'multimodal',
      maxImages: 10,
    }),
  ),
  ...['wan2.7-image-pro', 'wan2.7-image'].map(
    (name): AlibabaImageModel => ({
      name,
      description: `Генерация и редактирование изображений ${name}`,
      api: 'wan-image-async',
      maxImages: 9,
    }),
  ),
  {
    name: 'z-image-turbo',
    description: 'Быстрая генерация изображений Z-Image',
    api: 'multimodal',
    maxImages: 0,
  },
  {
    name: 'wan2.6-t2i',
    description: 'Генерация изображений Wan 2.6',
    api: 'wan-image-async',
    maxImages: 4,
  },
  {
    name: 'wan2.6-image',
    description: 'Генерация и редактирование изображений Wan 2.6',
    api: 'wan-image-async',
    maxImages: 4,
  },
  ...[
    'wan2.5-t2i-preview',
    'wan2.2-t2i-plus',
    'wan2.2-t2i-flash',
    'wan2.1-t2i-plus',
    'wan2.1-t2i-turbo',
  ].map(
    (name): AlibabaImageModel => ({
      name,
      description: `Генерация изображений ${name}`,
      api: 'wan-async',
      maxImages: 0,
    }),
  ),
  {
    name: 'wan2.5-i2i-preview',
    description: 'Редактирование изображений Wan 2.5',
    api: 'wan-edit-async',
    maxImages: 3,
    requiresImage: true,
  },
  {
    name: 'wanx2.1-imageedit',
    description: 'Редактирование изображений WanX 2.1 (Пекин)',
    api: 'wan-legacy-edit',
    maxImages: 1,
    requiresImage: true,
  },
];
