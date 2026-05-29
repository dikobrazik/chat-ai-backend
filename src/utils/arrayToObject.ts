export const arrayToObject = <T extends object, Key extends keyof T>(
  array: T[],
  keyName: Key,
) => {
  return array.reduce(
    (acc, value) => {
      acc[value[keyName]] = value;

      return acc;
    },
    {} as Record<Key, T>,
  );
};
