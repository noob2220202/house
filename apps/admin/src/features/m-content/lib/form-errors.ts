import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';

/**
 * Maps a failed mutation onto a form: backend validation details go to their fields, everything
 * else is returned as a message for a toast. Returns null when every detail landed on a field.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (error instanceof ApiError && error.isValidation) {
    const entries = Object.entries(error.fieldErrors());
    let mapped = 0;
    for (const [path, message] of entries) {
      if ((fields as readonly string[]).includes(path)) {
        setError(path as Path<T>, { message });
        mapped += 1;
      }
    }
    if (mapped > 0 && mapped === entries.length) return null;
  }
  return errorMessage(error);
}
