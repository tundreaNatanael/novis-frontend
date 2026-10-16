import { request } from './client'
import type {
  AcceptInviteRequest,
  AuthTokens,
  ForgotPasswordRequest,
  LoginRequest,
  Message,
  ResetPasswordRequest,
} from './types'

/** Public auth endpoints (API.md §4). None of them sends a bearer token. */
export const authApi = {
  login: (body: LoginRequest) =>
    request<AuthTokens>('/auth/login', { method: 'POST', body, auth: false }),
  logout: (refreshToken: string) =>
    request<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  acceptInvite: (body: AcceptInviteRequest) =>
    request<AuthTokens>('/auth/accept-invite', { method: 'POST', body, auth: false }),
  forgotPassword: (body: ForgotPasswordRequest) =>
    request<Message>('/auth/forgot-password', { method: 'POST', body, auth: false }),
  resetPassword: (body: ResetPasswordRequest) =>
    request<Message>('/auth/reset-password', { method: 'POST', body, auth: false }),
}
