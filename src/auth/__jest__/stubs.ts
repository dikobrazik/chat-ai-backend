import { UserStatus } from 'src/entities/User';

export const EMAIL_STUB = 'email';
export const DEBUG_EMAIL_STUB = 'a@tridva.ru';
export const PASSWORD_STUB = 'password';
export const PASSWORD_HASH_STUB =
  '$2b$10$T6QohKw8Wt6d2p63DvPruOhMLJXUwdvnCBqgCNOBpCWZyNUgxMgc6';

export const USER_STUB = {
  id: '1',
  name: 'Me',
  emailVerified: false,
  photo: null,
  email: EMAIL_STUB,
  passwordHash: PASSWORD_HASH_STUB,
  status: UserStatus.ACTIVE,
  active_subscription_id: null,
  created_at: new Date(),
};
