import { createBrowserRouter, Outlet, type RouteObject } from 'react-router'
import {
  HomeRedirect,
  RedirectIfAuthenticated,
  RequireAuth,
  RequireOrgAdmin,
  RequireSuperAdmin,
  RequireTeacher,
} from '@/auth/guards'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { RootErrorBoundary } from './root-error-boundary'
import type { RouteHandle } from './route-handle'

const crumb = (label: string): RouteHandle => ({ crumb: () => label })

/**
 * Every route of the console (README → Router). Pages are lazy route modules exporting
 * `Component` (and `handle` for breadcrumbs); the organization workspace is defined once and
 * mounted twice (`/platform/orgs/:orgId/*` for super-admins, `/org/:orgId/*` for admins).
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
    { path: 'lessons', lazy: () => import('@/features/org-workspace/pages/org-lessons-page') },
    { path: 'finance', lazy: () => import('@/features/org-workspace/pages/finance-page') },
  ]
  if (mount === 'platform') {
    routes.push(
      { path: 'admins', lazy: () => import('@/features/org-workspace/pages/admins-page') },
      {
        path: 'admins/:userId',
        lazy: () => import('@/features/org-workspace/pages/staff-detail-page'),
      },
    )
  } else {
    // The super-admin's lesson detail stays at /platform/lessons/:lessonId (D-009); an org
    // admin's lives in their workspace (D-040).
    routes.push({
      path: 'lessons/:lessonId',
      lazy: () => import('@/features/lessons/lesson-detail-page'),
    })
  }
  return routes
}

/**
 * The teacher workspace (D-051): its own shell at `/teach/*`, apart from the admin console, with
 * the screens of the mobile app. Pages are lazy route modules like the console's.
 */
function teacherWorkspaceRoutes(): RouteObject[] {
  return [
    { index: true, lazy: () => import('@/features/teach/pages/today-page') },
    { path: 'students', lazy: () => import('@/features/teach/pages/students-page') },
    {
      path: 'students/:studentId',
      lazy: () => import('@/features/teach/pages/student-detail-page'),
    },
    { path: 'calendar', lazy: () => import('@/features/teach/pages/calendar-page') },
    { path: 'courses', lazy: () => import('@/features/teach/pages/courses-page') },
    { path: 'courses/:courseId', lazy: () => import('@/features/teach/pages/course-detail-page') },
    { path: 'lessons/:lessonId', lazy: () => import('@/features/teach/pages/lesson-detail-page') },
    { path: 'payments', lazy: () => import('@/features/teach/pages/payments-page') },
    { path: 'payments/:payoutId', lazy: () => import('@/features/teach/pages/payout-detail-page') },
    { path: 'profile', lazy: () => import('@/features/teach/pages/profile-page') },
  ]
}

/** The route tree, also mounted in tests through `createMemoryRouter`. */
export const routes: RouteObject[] = [
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
            path: 'teach',
            element: <RequireTeacher />,
            children: [
              {
                lazy: () => import('@/features/teach/teach-layout'),
                children: teacherWorkspaceRoutes(),
              },
            ],
          },
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
                    element: <Outlet />,
                    handle: crumb('Organizations'),
                    children: [
                      { index: true, lazy: () => import('@/features/platform/organizations-page') },
                      {
                        path: ':orgId',
                        lazy: () => import('@/features/org-workspace/org-workspace-layout'),
                        children: orgWorkspaceRoutes('platform'),
                      },
                    ],
                  },
                  {
                    path: 'platform/freelance',
                    element: <Outlet />,
                    handle: crumb('Freelance teachers'),
                    children: [
                      {
                        index: true,
                        lazy: () => import('@/features/freelance/freelance-teachers-page'),
                      },
                      {
                        path: ':teacherId',
                        lazy: () => import('@/features/freelance/freelance-teacher-layout'),
                        children: [
                          {
                            index: true,
                            lazy: () => import('@/features/freelance/pages/freelance-profile-page'),
                          },
                          {
                            path: 'students',
                            lazy: () =>
                              import('@/features/freelance/pages/freelance-students-page'),
                          },
                          {
                            path: 'students/:studentId',
                            lazy: () =>
                              import('@/features/org-workspace/pages/student-detail-page'),
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
                    ],
                  },
                  {
                    path: 'platform/lessons',
                    element: <Outlet />,
                    handle: crumb('Lessons'),
                    children: [
                      { index: true, lazy: () => import('@/features/lessons/lessons-page') },
                      {
                        path: ':lessonId',
                        lazy: () => import('@/features/lessons/lesson-detail-page'),
                      },
                    ],
                  },
                ],
              },
              // One organization per admin: the old `/org` picker URL just goes home.
              { path: 'org', element: <HomeRedirect /> },
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
]

export const router = createBrowserRouter(routes)
