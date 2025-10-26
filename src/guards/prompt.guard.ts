import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected generateKey(
    context: ExecutionContext,
    suffix: string,
    name: string,
  ): string {
    const today = new Date().toISOString().split('T')[0];
    // 3. Формируем уникальный ключ, включая дату
    // Ключ будет выглядеть так: "tracker_192.168.1.1_daily_2025-10-23"
    // При смене даты на "2025-10-24" ключ изменится, и счетчик обнулится.
    return `${suffix}_${name}_${today}`;
  }

  protected getErrorMessage(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    return Promise.resolve(
      `Превышен дневной лимит запросов. Попробуйте снова ${throttlerLimitDetail.timeToBlockExpire} секунд спустя.`,
    );
  }

  // Используем стандартную логику для получения трекера (IP-адрес по умолчанию)
  protected getTracker(req) {
    return req.user?.id ? `user_${req.user.id}` : req.ip;
  }
}
