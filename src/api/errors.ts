/**
 * The `code`s API.md §1.6 documents. UI copy branches on these, never on `message` text.
 * `ApiError.code` stays a `string`: an unknown code (or `HTTP_<status>` for a body without one)
 * falls back to the server's message.
 */
export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'BAD_REQUEST'
  | 'MALFORMED_REQUEST'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'ACCOUNT_UNAVAILABLE'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'NOT_IMPLEMENTED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  // One role per account (409): a role elsewhere, a pending invitation elsewhere, a known
  // account without a role on a direct create (`POST /orgs/{orgId}/staff`, `POST /freelance-teachers`).
  | 'ROLE_CONFLICT'
  | 'INVITE_PENDING'
  | 'ACCOUNT_WITHOUT_ROLE'
  // `POST /auth/accept-invite` (400): an existing account's current password did not match,
  // that account is disabled, the invitation's organization is no longer active.
  | 'INVITE_PASSWORD_MISMATCH'
  | 'INVITE_ACCOUNT_DISABLED'
  | 'INVITE_ORGANIZATION_INACTIVE'

/** The error body every Novis endpoint returns (API.md §1.6). */
export interface FieldError {
  field: string
  message: string
}

export interface ApiErrorBody {
  timestamp: string
  status: number
  code: string
  message: string
  fieldErrors: FieldError[]
}

/** A non-2xx answer from the API, with the parsed `ApiError` body. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }

  /** Builds an error from whatever the server sent; tolerates non-JSON and partial bodies. */
  static fromBody(status: number, body: unknown, fallbackMessage: string): ApiError {
    if (body && typeof body === 'object') {
      const record = body as Partial<ApiErrorBody>
      const code = typeof record.code === 'string' ? record.code : `HTTP_${status}`
      const message = typeof record.message === 'string' ? record.message : fallbackMessage
      const fieldErrors = Array.isArray(record.fieldErrors)
        ? record.fieldErrors.filter(
            (entry): entry is FieldError =>
              !!entry && typeof entry.field === 'string' && typeof entry.message === 'string',
          )
        : []
      return new ApiError(status, code, message, fieldErrors)
    }
    return new ApiError(status, `HTTP_${status}`, fallbackMessage)
  }

  is(code: ApiErrorCode): boolean {
    return this.code === code
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isConflict(): boolean {
    return this.status === 409
  }

  get isValidation(): boolean {
    return this.status === 400 && this.fieldErrors.length > 0
  }
}

/** The request never reached the API (offline, DNS, CORS, server down). */
export class NetworkError extends Error {
  constructor(
    message = 'The API could not be reached. Check your connection and that the API is running.',
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * `409` codes of the one-role-per-account rule (API.md §1.6). Same-place duplicates stay
 * `CONFLICT` and keep the sentence of the form that sent them.
 */
export const CONFLICT_COPY = {
  ROLE_CONFLICT: 'This email already belongs to an account with a role elsewhere in Novis.',
  INVITE_PENDING: 'This email already has a pending invitation elsewhere.',
  ACCOUNT_WITHOUT_ROLE:
    'This email already belongs to an account without a role. Invite it by email instead; the person accepts with their current password and keeps their name.',
} satisfies Partial<Record<ApiErrorCode, string>>

/** A sentence for toasts and inline errors; never apologizes, always says what happened. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isValidation) {
      return error.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(', ')
    }
    switch (error.code) {
      case 'TOO_MANY_REQUESTS':
        return 'Too many attempts. Wait a minute and try again.'
      case 'NOT_FOUND':
        return 'Not found, or not accessible with your role.'
      case 'FORBIDDEN':
        return 'Your role does not allow this action.'
      case 'ROLE_CONFLICT':
        return CONFLICT_COPY.ROLE_CONFLICT
      case 'INVITE_PENDING':
        return CONFLICT_COPY.INVITE_PENDING
      case 'ACCOUNT_WITHOUT_ROLE':
        return CONFLICT_COPY.ACCOUNT_WITHOUT_ROLE
      default:
        return error.message || `Request failed (${error.status}).`
    }
  }
  if (error instanceof NetworkError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
