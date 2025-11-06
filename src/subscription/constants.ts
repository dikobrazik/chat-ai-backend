import { SubscriptionPlan } from '../entities/Subscription';

export const PLANS = [
  {
    id: SubscriptionPlan.BASE,
    name: 'Базовая подписка',
    price: 200,
    features: [
      'Подойдет для личного использования',
      'Доступ к базовым функциям сервиса',
      'Ограниченное количество запросов в месяц',
    ],
  },
  {
    id: SubscriptionPlan.PLUS,
    name: 'Подписка Плюс',
    price: 550,
    features: [
      'Для активных пользователей и небольших команд',
      'Расширенный доступ к функциям сервиса',
      'Увеличенное количество запросов в месяц',
      'Приоритетная поддержка клиентов',
    ],
  },
  {
    id: SubscriptionPlan.PRO,
    name: 'Подписка Про',
    price: 3000,
    features: [
      'Для профессионалов и крупных команд',
      'Полный доступ ко всем функциям сервиса',
      'Неограниченное количество запросов',
      'Персональный менеджер и приоритетная поддержка',
    ],
  },
];

export const PLAN_PRICE = Object.fromEntries(
  PLANS.map((plan) => [plan.id, plan.price]),
);
