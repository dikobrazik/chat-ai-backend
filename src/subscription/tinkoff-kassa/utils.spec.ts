import {generateTokenFromBody} from './utils';

const body = {
  TerminalKey: 'MerchantTerminalKey',
  Amount: 19200,
  OrderId: '21090',
  Description: 'Подарочная карта на 1000 рублей',
  DATA: {
    Phone: '+71234567890',
    Email: 'a@test.com',
  },
  Receipt: {
    Email: 'a@test.ru',
    Phone: '+79031234567',
    Taxation: 'osn',
    Items: [
      {
        Name: 'Наименование товара 1',
        Price: 10000,
        Quantity: 1,
        Amount: 10000,
        Tax: 'vat10',
        Ean13: '303130323930303030630333435',
      },
      {
        Name: 'Наименование товара 2',
        Price: 3500,
        Quantity: 2,
        Amount: 7000,
        Tax: 'vat20',
      },
      {
        Name: 'Наименование товара 3',
        Price: 550,
        Quantity: 4,
        Amount: 4200,
        Tax: 'vat10',
      },
    ],
  },
};

describe('generateTokenFromBody', () => {
  it('should generate token', () => {
    expect(generateTokenFromBody(body, 'usaf8fw8fsw21g')).toEqual(
      '0024a00af7c350a3a67ca168ce06502aa72772456662e38696d48b56ee9c97d9',
    );
  });
});
