import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/errors'

/**
 * Puts the server's `fieldErrors` (`400 VALIDATION_FAILED`) on the matching form fields. `true`
 * when at least one landed on a field; otherwise the caller shows the error as a whole.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!isApiError(error) || error.fieldErrors.length === 0) return false
  let applied = false
  for (const fieldError of error.fieldErrors) {
    const field = fields.find((f) => f === fieldError.field)
    if (field) {
      setError(field, { type: 'server', message: fieldError.message })
      applied = true
    }
  }
  return applied
}
