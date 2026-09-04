import * as bcrypt from 'bcrypt';

export function generatePasswordHash(data: string, saltRounds = 10) {
  return bcrypt.hash(data, saltRounds);
}
