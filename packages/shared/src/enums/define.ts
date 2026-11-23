/**
 * Enums are plain `as const` objects so they work in zod (`z.enum(X)`), in Prisma-free
 * frontends, and stay string-compatible with the Prisma-generated enums of the same name.
 * apps/api has a unit test asserting every shared enum equals its Prisma counterpart.
 */
export type EnumValue<T extends Record<string, string>> = T[keyof T];

export function enumValues<T extends Record<string, string>>(e: T): EnumValue<T>[] {
  return Object.values(e) as EnumValue<T>[];
}

export function isEnumValue<T extends Record<string, string>>(
  e: T,
  value: unknown,
): value is EnumValue<T> {
  return typeof value === 'string' && Object.values<string>(e).includes(value);
}
