import { createHash } from 'crypto';
import { Device, DeviceOS } from './types';

const MOSCOW_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

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

export const formatMoscowDate = (date: Date) => {
  const parts = Object.fromEntries(
    MOSCOW_DATE_FORMATTER.formatToParts(date)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+03:00`;
};

export const prepareDeviceInfo = (device: { type: string; os: string }) => {
  const deviceType: Device = device.type === 'mobile' ? 'Mobile' : 'Desktop';

  let deviceOs: DeviceOS;

  switch (device.os) {
    case 'Windows':
      deviceOs = 'Windows';
      break;
    case 'Linux':
      deviceOs = 'Linux';
      break;
    case 'macOS':
      deviceOs = 'macOS';
      break;
    case 'iOS':
      deviceOs = 'iOS';
      break;
    case 'Android':
      deviceOs = 'Android';
      break;
    default:
      throw new Error(`Unsupported OS: ${device.os}`);
  }

  return { deviceType, deviceOs };
};
