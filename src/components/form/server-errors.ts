import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { errorMessage, isApiError } from '@/api/errors'

/**
 * Puts the server's `fieldErrors` on the matching form fields and returns the message to show
 * at form level (the field errors it placed, or the error's own message). Unknown fields fall
 * back to the form-level message so nothing is lost.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string {
  if (isApiError(error) && error.fieldErrors.length > 0) {
    const unmatched: string[] = []
    for (const fieldError of error.fieldErrors) {
      const field = fields.find((f) => f === fieldError.field)
      if (field) setError(field, { type: 'server', message: fieldError.message })
      else unmatched.push(`${fieldError.field}: ${fieldError.message}`)
    }
    return unmatched.length > 0 ? unmatched.join(', ') : ''
  }
  return errorMessage(error)
}
