import { Controller, Get, Inject, Post } from '@nestjs/common';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  @Inject(SubscriptionService)
  private readonly subscriptionService: SubscriptionService;

  @Post('cancel')
  public cancelSubscription(@User() user: UserEntity) {
    return this.subscriptionService.cancelSubscription(user.id);
  }

  @Get()
  public getActiveSubscription(@User() user: UserEntity) {
    if (!user.active_subscription_id) {
      return null;
    }

    return this.subscriptionService.getSubscription(
      user.active_subscription_id,
    );
  }
}
