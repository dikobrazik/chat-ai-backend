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

  @Post('resume')
  public resumeSubscription(@User() user: UserEntity) {
    return this.subscriptionService.resumeSubscription(user.id);
  }

  @Get()
  public getCurrentSubscription(@User() user: UserEntity) {
    return this.subscriptionService.getCurrentSubscriptionForUser(user.id);
  }
}
