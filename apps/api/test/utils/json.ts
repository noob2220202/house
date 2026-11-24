const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * JSON of `value` with every UUID replaced by `<id>`, for "this secret never leaks" substring
 * checks: random ids can contain any short digit run (e.g. a 호 like 1203).
 */
export function withoutUuids(value: unknown): string {
  return JSON.stringify(value).replace(UUID, '<id>');
}
