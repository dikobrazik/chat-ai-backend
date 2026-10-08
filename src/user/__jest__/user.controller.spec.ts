import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { type Mocked, TestBed } from '@suites/unit';
import { User } from 'src/entities/User';
import { PatchUserDto } from 'src/user/dto';
import { UserController } from 'src/user/user.controller';
import { UserService } from 'src/user/user.service';

describe(UserController.name, () => {
  it('Обновляет профиль авторизованного пользователя', async () => {
    const { unit, unitRef } = await TestBed.solitary(UserController).compile();
    const service: Mocked<UserService> = unitRef.get(UserService);
    const user = Object.assign(new User(), { id: 'user-id' });
    const body = { name: 'New name', mailing_consent: false };
    const updated = { ...user, ...body };
    service.updateProfile.mockResolvedValue(updated);

    await expect(unit.patchProfile(user, body)).resolves.toEqual(updated);
    expect(service.updateProfile).toHaveBeenCalledWith(user.id, body);
  });

  describe('Валидация профиля', () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const metadata = { type: 'body' as const, metatype: PatchUserDto };

    it.each([{}, { name: '' }, { mailing_consent: false }])(
      'Принимает частичное обновление %j',
      async (body) => {
        await expect(pipe.transform(body, metadata)).resolves.toEqual(body);
      },
    );

    it.each([
      { name: null },
      { email: null },
      { mailing_consent: null },
      { name: 123 },
      { name: 'a'.repeat(256) },
      { email: 'not-an-email' },
      { mailing_consent: 'false' },
      { mailing_consent: 1 },
      { status: 'verified' },
      { id: 'another-user' },
      { passwordHash: 'hash' },
      { emailVerified: true },
    ])('Отклоняет некорректное обновление %j', async (body) => {
      await expect(pipe.transform(body, metadata)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
