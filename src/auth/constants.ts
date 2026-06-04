export const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  // path: '/api/auth',
} as const;
