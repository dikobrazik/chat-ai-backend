import { UserStatus } from 'src/entities/User';

export const DEEPSEEK_MODELS = [
  {
    id: 'deepseek:deepseek-flash',
    provider_id: 4,
    name: 'deepseek-flash',
    description: 'Быстрая модель DeepSeek для повседневных задач',
    for_image: false,
    available_for_status: UserStatus.ACTIVE,
  },
  {
    id: 'deepseek:deepseek-v4-pro',
    provider_id: 4,
    name: 'deepseek-v4-pro',
    description: 'Модель DeepSeek для сложных задач',
    for_image: false,
    available_for_status: UserStatus.SUBSCRIPTION_PLUS,
  },
];
