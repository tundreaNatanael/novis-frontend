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
import { adminOrganization, isSuperAdmin } from '@/lib/permissions'

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

/** Sidebar entries for the signed-in user: the platform for the super-admin, their one organization for an admin. */
export function navigationFor(me: User): NavSection[] {
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
  const org = adminOrganization(me)
  if (!org) return []
  const base = `/org/${org.id}`
  return [
    {
      label: org.name,
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
