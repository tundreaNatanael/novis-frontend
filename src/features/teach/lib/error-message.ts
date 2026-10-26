import { ApiError, NetworkError, isApiError } from '@/api/errors'
import type { Translator } from '../i18n/types'

/** Maps any thrown value to translated copy per API.md §1.6, by `code`, never by message text. */
export function describeError(error: unknown, t: Translator): string {
  if (error instanceof NetworkError) return t('errors.network')
  if (!isApiError(error)) return t('errors.generic')
  switch (error.code) {
    case 'VALIDATION_FAILED':
      return t('errors.validation')
    case 'BAD_REQUEST':
    case 'CONFLICT':
      return error.message || t('errors.conflict')
    case 'ROLE_CONFLICT':
      return t('errors.roleConflict')
    case 'INVITE_PENDING':
      return t('errors.invitePending')
    case 'ACCOUNT_WITHOUT_ROLE':
      return t('errors.accountWithoutRole')
    case 'SCHEDULE_CONFLICT':
      return t('errors.scheduleConflict')
    case 'UPLOAD_INCOMPLETE':
      return t('errors.uploadIncomplete')
    case 'UPLOAD_REJECTED':
      return t('errors.uploadRejected')
    case 'NOT_FOUND':
      return t('errors.notFound')
    case 'FORBIDDEN':
      return t('errors.forbidden')
    case 'TOO_MANY_REQUESTS':
      return t('errors.rateLimited')
    case 'NOT_IMPLEMENTED':
      return t('errors.notImplemented')
    case 'SERVICE_UNAVAILABLE':
    case 'INTERNAL_ERROR':
      return t('errors.server')
    default:
      return error.status >= 500 ? t('errors.server') : t('errors.generic')
  }
}

export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

/** The server's message for one field of a `400 VALIDATION_FAILED`, if any. */
export function fieldErrorOf(error: unknown, field: string): string | undefined {
  if (!isApiError(error)) return undefined
  return error.fieldErrors.find((entry) => entry.field === field)?.message
}
