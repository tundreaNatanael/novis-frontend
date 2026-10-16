import {
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Mail,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { User } from '@/api/types'
import { adminOrganizations, isSuperAdmin } from '@/lib/permissions'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Match nested routes too (default) or only the exact path. */
  end?: boolean
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

/** Sidebar entries for the signed-in user and the organization in the URL (admins). */
export function navigationFor(me: User, activeOrgId: string | null): NavSection[] {
  if (isSuperAdmin(me)) {
    return [
      {
        items: [
          { label: 'Overview', to: '/platform', icon: LayoutDashboard, end: true },
          { label: 'Organizations', to: '/platform/orgs', icon: Building2 },
          { label: 'Freelance teachers', to: '/platform/freelance', icon: UserRound },
          { label: 'Lessons', to: '/platform/lessons', icon: CalendarDays },
        ],
      },
    ]
  }
  const orgs = adminOrganizations(me)
  const orgId = activeOrgId ?? orgs[0]?.organizationId
  if (!orgId) return []
  const base = `/org/${orgId}`
  return [
    {
      label: orgs.find((o) => o.organizationId === orgId)?.organizationName,
      items: [
        { label: 'Overview', to: base, icon: LayoutDashboard, end: true },
        { label: 'Teachers', to: `${base}/teachers`, icon: Users },
        { label: 'Students', to: `${base}/students`, icon: GraduationCap },
        { label: 'Courses', to: `${base}/courses`, icon: BookOpen },
        { label: 'Invites', to: `${base}/invites`, icon: Mail },
      ],
    },
  ]
}
