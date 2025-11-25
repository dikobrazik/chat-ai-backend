import { BinaryToTextEncoding, createHash } from 'crypto';

export function generateHash(
  data: string,
  algorithm = 'sha256',
  encoding: BinaryToTextEncoding = 'hex',
) {
  const hash = createHash(algorithm);
  hash.update(data);
  return hash.digest(encoding);
}
