import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { orgKeys, orgsApi } from '@/api/orgs'
import type { User } from '@/api/types'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { isSuperAdmin } from '@/lib/permissions'
import type { NavSection } from './navigation'

interface CommandPaletteProps {
  me: User
  sections: NavSection[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** ⌘K / Ctrl+K: jump to a page or, for the super-admin, straight into an organization. */
export function CommandPalette({ me, sections, open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const superAdmin = isSuperAdmin(me)

  const orgs = useQuery({
    queryKey: orgKeys.list({ size: 100, sort: 'name,asc' }),
    queryFn: ({ signal }) => orgsApi.list({ size: 100, sort: 'name,asc' }, signal),
    enabled: open && superAdmin,
    staleTime: 60_000,
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const go = (to: string) => {
    onOpenChange(false)
    setQuery('')
    navigate(to)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Search pages and organizations"
    >
      <CommandInput
        placeholder="Jump to a page or organization…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Pages">
          {sections.flatMap((section) =>
            section.items.map((item) => (
              <CommandItem key={item.to} value={`page ${item.label}`} onSelect={() => go(item.to)}>
                <item.icon aria-hidden />
                {item.label}
              </CommandItem>
            )),
          )}
          <CommandItem value="page account" onSelect={() => go('/account')}>
            Account
          </CommandItem>
        </CommandGroup>
        {superAdmin ? (
          <CommandGroup heading="Organizations">
            {(orgs.data?.content ?? []).map((org) => (
              <CommandItem
                key={org.id}
                value={`org ${org.name} ${org.slug}`}
                onSelect={() => go(`/platform/orgs/${org.id}`)}
              >
                <Building2 aria-hidden />
                <span className="truncate">{org.name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{org.slug}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
