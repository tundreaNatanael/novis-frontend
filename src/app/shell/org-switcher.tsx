import { Check, ChevronsUpDown } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import type { User } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { adminOrganizations } from '@/lib/permissions'

/** Admins of several organizations switch here; the current tab is kept when it exists in the other org. */
export function OrgSwitcher({ me, activeOrgId }: { me: User; activeOrgId: string | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const orgs = adminOrganizations(me)
  if (orgs.length < 2) return null
  const active = orgs.find((o) => o.organizationId === activeOrgId)

  const switchTo = (orgId: string) => {
    const match = /^\/org\/[^/]+\/([^/]+)/.exec(location.pathname)
    const tab = match?.[1]
    navigate(tab ? `/org/${orgId}/${tab}` : `/org/${orgId}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-44 shrink-0 justify-between gap-2 sm:max-w-56"
          aria-label="Switch organization"
        >
          <span className="truncate">{active?.organizationName ?? 'Choose organization'}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem key={org.organizationId} onSelect={() => switchTo(org.organizationId)}>
            <span className="truncate">{org.organizationName}</span>
            {org.organizationId === activeOrgId ? <Check className="ml-auto" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
