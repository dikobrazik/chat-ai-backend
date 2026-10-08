import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TestBed, type Mocked } from '@suites/unit';
import { Cache } from 'cache-manager';
import { User, UserStatus } from 'src/entities/User';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';

describe(UserService.name, () => {
  let service: UserService;
  let repository: Mocked<Repository<User>>;
  let cache: Mocked<Cache>;
  let user: User;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(UserService)
      .mock(CACHE_MANAGER)
      .impl(() => ({ del: jest.fn(), wrap: jest.fn() }))
      .compile();

    service = unit;
    repository = unitRef.get(getRepositoryToken(User).toString());
    cache = unitRef.get(CACHE_MANAGER);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    user = Object.assign(new User(), {
      id: 'user-id',
      name: 'Old name',
      email: 'old@example.com',
      emailVerified: true,
      mailing_consent: true,
      status: UserStatus.VERIFIED,
    });
    repository.findOne.mockResolvedValue(user);
    repository.update.mockResolvedValue({
      affected: 1,
      raw: [],
      generatedMaps: [],
    });
  });

  it('Обновляет только переданные поля и возвращает свежий профиль', async () => {
    const updated = { ...user, name: 'New name', mailing_consent: false };
    const findById = jest.spyOn(service, 'findById').mockResolvedValue(updated);

    await expect(
      service.updateProfile(user.id, {
        name: 'New name',
        mailing_consent: false,
      }),
    ).resolves.toEqual(updated);

    expect(repository.update).toHaveBeenCalledWith(user.id, {
      name: 'New name',
      mailing_consent: false,
    });
    expect(cache.del).toHaveBeenCalledWith(`user:${user.id}`);
    expect(findById).toHaveBeenCalledWith(user.id);
    expect(cache.del.mock.invocationCallOrder[0]).toBeLessThan(
      findById.mock.invocationCallOrder[0],
    );
  });

  it('Не выполняет обновление для пустого запроса', async () => {
    await expect(service.updateProfile(user.id, {})).resolves.toEqual(user);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('Возвращает 404 для отсутствующего пользователя', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.updateProfile(user.id, { name: 'New' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('Не скрывает другие ошибки базы данных', async () => {
    const error = new Error('database unavailable');
    repository.update.mockRejectedValue(error);

    await expect(service.updateProfile(user.id, { name: 'New' })).rejects.toBe(
      error,
    );
  });
});
