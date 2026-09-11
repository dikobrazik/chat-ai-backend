import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TestBed, type Mocked } from '@suites/unit';
import { type Request } from 'express';
import { type Model } from 'src/entities/Model';
import { UserStatus } from 'src/entities/User';
import { ModelService } from 'src/model/model.service';
import { ModelGuard } from '../model.guard';

const createContext = (modelId: number, userStatus: UserStatus) =>
  ({
    switchToHttp: () => ({
      getRequest: () =>
        ({
          body: { model_id: modelId },
          user: { status: userStatus },
        }) as Request,
    }),
  }) as ExecutionContext;

describe(ModelGuard.name, () => {
  let modelGuard: ModelGuard;
  let modelServiceMock: Mocked<ModelService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(ModelGuard)
      .mock(ModelService)
      .impl(() => ({
        getModel: jest.fn(),
      }))
      .compile();

    modelGuard = unit;
    modelServiceMock = unitRef.get(ModelService);
  });

  it.each([
    [UserStatus.GUEST, UserStatus.GUEST],
    [UserStatus.ACTIVE, UserStatus.GUEST],
    [UserStatus.SUBSCRIPTION_PRO, UserStatus.SUBSCRIPTION_PLUS],
  ])(
    'должен разрешать доступ пользователю со статусом %s к модели, доступной со статуса %s',
    async (userStatus: UserStatus, availableForStatus: UserStatus) => {
      modelServiceMock.getModel.mockResolvedValueOnce({
        available_for_status: availableForStatus,
      } as Model);

      await expect(
        modelGuard.canActivate(createContext(42, userStatus)),
      ).resolves.toBe(true);

      expect(modelServiceMock.getModel).toHaveBeenLastCalledWith(42);
    },
  );

  it('должен отклонять запрос пользователя со статусом ниже требуемого для модели', async () => {
    modelServiceMock.getModel.mockResolvedValueOnce({
      available_for_status: UserStatus.SUBSCRIPTION_BASE,
    } as Model);

    await expect(
      modelGuard.canActivate(createContext(7, UserStatus.VERIFIED)),
    ).rejects.toThrow(
      new ForbiddenException('Данная модель не доступна на вашем тарифе'),
    );

    expect(modelServiceMock.getModel).toHaveBeenLastCalledWith(7);
  });
});
