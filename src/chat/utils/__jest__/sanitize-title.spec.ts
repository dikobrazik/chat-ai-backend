import { sanitizeTitle } from '../sanitize-title';

describe(sanitizeTitle.name, () => {
  it.each`
    generated        | expected
    ${`"test"`}      | ${`test`}
    ${`'test'`}      | ${`test`}
    ${`hi "test"`}   | ${`hi "test"`}
    ${`«hi "test"»`} | ${`hi "test"`}
  `('should remove quotes from the title', ({ generated, expected }) => {
    const sanitizedTitle = sanitizeTitle(generated);
    expect(sanitizedTitle).toBe(expected);
  });
});
