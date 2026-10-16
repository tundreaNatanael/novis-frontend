import { createBrowserRouter, type RouteObject } from 'react-router'
import {
  HomeRedirect,
  RedirectIfAuthenticated,
  RequireAuth,
  RequireOrgAdmin,
  RequireSuperAdmin,
} from '@/auth/guards'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { RootErrorBoundary } from './root-error-boundary'

/**
 * Every route of the console (README → Router). Pages are lazy route modules exporting
 * `Component`; the organization workspace is defined once and mounted twice
 * (`/platform/orgs/:orgId/*` for super-admins, `/org/:orgId/*` for admins).
 */
function orgWorkspaceRoutes(mount: 'platform' | 'org'): RouteObject[] {
  const routes: RouteObject[] = [
    { index: true, lazy: () => import('@/features/org-workspace/pages/org-overview-page') },
    { path: 'teachers', lazy: () => import('@/features/org-workspace/pages/teachers-page') },
    {
      path: 'teachers/:userId',
      lazy: () => import('@/features/org-workspace/pages/staff-detail-page'),
    },
    { path: 'students', lazy: () => import('@/features/org-workspace/pages/students-page') },
    {
      path: 'students/:studentId',
      lazy: () => import('@/features/org-workspace/pages/student-detail-page'),
    },
    { path: 'courses', lazy: () => import('@/features/org-workspace/pages/courses-page') },
    {
      path: 'courses/:courseId',
      lazy: () => import('@/features/org-workspace/pages/course-detail-page'),
    },
    { path: 'invites', lazy: () => import('@/features/org-workspace/pages/invites-page') },
  ]
  if (mount === 'platform') {
    routes.push(
      { path: 'admins', lazy: () => import('@/features/org-workspace/pages/admins-page') },
      {
        path: 'admins/:userId',
        lazy: () => import('@/features/org-workspace/pages/staff-detail-page'),
      },
      { path: 'lessons', lazy: () => import('@/features/org-workspace/pages/org-lessons-page') },
    )
  }
  return routes
}

export const router = createBrowserRouter([
  {
    path: '/',
    ErrorBoundary: RootErrorBoundary,
    HydrateFallback: FullPageSpinner,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: 'login', lazy: () => import('@/features/auth/login-page') },
          { path: 'forgot-password', lazy: () => import('@/features/auth/forgot-password-page') },
        ],
      },
      { path: 'reset-password/:token', lazy: () => import('@/features/auth/reset-password-page') },
      { path: 'invite/:token', lazy: () => import('@/features/auth/accept-invite-page') },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'no-access', lazy: () => import('@/features/auth/no-access-page') },
          {
            lazy: () => import('./shell/app-shell'),
            children: [
              { path: 'account', lazy: () => import('@/features/account/account-page') },
              {
                element: <RequireSuperAdmin />,
                children: [
                  {
                    path: 'platform',
                    lazy: () => import('@/features/platform/platform-overview-page'),
                  },
                  {
                    path: 'platform/orgs',
                    lazy: () => import('@/features/platform/organizations-page'),
                  },
                  {
                    path: 'platform/orgs/:orgId',
                    lazy: () => import('@/features/org-workspace/org-workspace-layout'),
                    children: orgWorkspaceRoutes('platform'),
                  },
                  {
                    path: 'platform/freelance',
                    lazy: () => import('@/features/freelance/freelance-teachers-page'),
                  },
                  {
                    path: 'platform/freelance/:teacherId',
                    lazy: () => import('@/features/freelance/freelance-teacher-layout'),
                    children: [
                      {
                        index: true,
                        lazy: () => import('@/features/freelance/pages/freelance-profile-page'),
                      },
                      {
                        path: 'students',
                        lazy: () => import('@/features/freelance/pages/freelance-students-page'),
                      },
                      {
                        path: 'students/:studentId',
                        lazy: () => import('@/features/org-workspace/pages/student-detail-page'),
                      },
                      {
                        path: 'courses',
                        lazy: () => import('@/features/freelance/pages/freelance-courses-page'),
                      },
                      {
                        path: 'courses/:courseId',
                        lazy: () => import('@/features/org-workspace/pages/course-detail-page'),
                      },
                      {
                        path: 'lessons',
                        lazy: () => import('@/features/freelance/pages/freelance-lessons-page'),
                      },
                    ],
                  },
                  {
                    path: 'platform/lessons',
                    lazy: () => import('@/features/lessons/lessons-page'),
                  },
                  {
                    path: 'platform/lessons/:lessonId',
                    lazy: () => import('@/features/lessons/lesson-detail-page'),
                  },
                ],
              },
              { path: 'org', lazy: () => import('@/features/org-workspace/org-picker-page') },
              {
                path: 'org/:orgId',
                element: <RequireOrgAdmin />,
                children: [
                  {
                    lazy: () => import('@/features/org-workspace/org-workspace-layout'),
                    children: orgWorkspaceRoutes('org'),
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', lazy: () => import('./not-found-page') },
    ],
  },
])
