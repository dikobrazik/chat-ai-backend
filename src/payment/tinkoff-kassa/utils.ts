import { createHash } from 'crypto';
import { Device, DeviceOS } from './types';

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
