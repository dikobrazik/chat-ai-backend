import {createHash} from 'crypto';

export const generateTokenFromBody = (
  body: Record<string, any>,
  password: string,
) => {
  const bodyArray = Object.entries(body).filter(
    ([, value]) => typeof value !== 'object',
  );

  bodyArray.push(['Password', password]);

  const bodyValuesString = bodyArray
    .sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
    .map(([, value]) => value)
    .join('');

  return createHash('sha256').update(bodyValuesString, 'utf-8').digest('hex');
};
