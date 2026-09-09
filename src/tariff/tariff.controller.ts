import { Controller, Get, Inject, Query } from '@nestjs/common';
import { User } from 'src/decorators/user.decorator';
import { User as UserEntity } from 'src/entities/User';
import { TariffService } from './tariff.service';

@Controller('tariffs')
export class TariffController {
  @Inject(TariffService)
  private readonly subscriptionService: TariffService;

  @Get()
  public async getTariffs(
    @User() user: UserEntity,
    @Query('sixMonths') sixMonths: string,
  ) {
    return this.subscriptionService.getUserTariffs(
      user.id,
      sixMonths === 'true',
    );
  }
}
