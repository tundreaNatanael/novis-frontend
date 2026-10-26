import { CalendarDays, CircleAlert, Search, Ticket, UserPlus, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { RosterStudent } from '@/api/types'
import type { RouteHandle } from '@/app/route-handle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TeachAvatar } from '../components/avatar'
import { PageTitle } from '../components/section'
import { EmptyState, ErrorState, SkeletonList } from '../components/states'
import { TeachBadge } from '../components/teach-badge'
import { filterRoster, useFullRoster } from '../data/roster'
import { useT } from '../i18n/use-i18n'
import { useFormatters } from '../lib/use-formatters'
import { useTeachTitle } from '../lib/use-teach-title'
import { useTeachSheets } from '../sheets/use-teach-sheets'
import { paymentCounts } from '../students/utils'

export const handle: RouteHandle = { title: 'Students' }

/** The roster (`GET /teacher/students`): a card per student with the next lesson and the counts with this teacher. */
export function Component() {
  const t = useT()
  const sheets = useTeachSheets()
  const [search, setSearch] = useState('')
  const roster = useFullRoster()
  const items = useMemo(() => filterRoster(roster.students, search), [roster.students, search])
  useTeachTitle(t('teacher.students.title'))

  return (
    <div className="flex flex-col gap-5">
      <PageTitle
        title={t('teacher.students.title')}
        subtitle={
          roster.isPending
            ? undefined
            : t('teacher.students.count', { count: roster.students.length })
        }
        actions={
          <Button
            type="button"
            className="rounded-full"
            onClick={() => sheets.open({ kind: 'student' })}
          >
            <UserPlus aria-hidden />
            {t('teacher.students.add')}
          </Button>
        }
      />
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('teacher.students.search')}
          aria-label={t('teacher.students.search')}
          className="h-10 rounded-full pl-9"
        />
        {search ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
            onClick={() => setSearch('')}
            aria-label={t('common.close')}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      {roster.isPending ? (
        <SkeletonList rows={6} />
      ) : roster.error && roster.students.length === 0 ? (
        <ErrorState error={roster.error} onRetry={() => void roster.refetch()} />
      ) : roster.students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('teacher.students.empty')}
          hint={t('teacher.students.emptyHint')}
          action={
            <Button
              type="button"
              className="rounded-full"
              onClick={() => sheets.open({ kind: 'student' })}
            >
              <UserPlus aria-hidden />
              {t('teacher.students.add')}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title={t('teacher.students.noResults', { query: search.trim() })}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((student) => (
            <li key={student.id} className="min-w-0">
              <StudentCard student={student} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StudentCard({ student }: { student: RosterStudent }) {
  const t = useT()
  const fmt = useFormatters()
  const next = student.nextLesson?.scheduledAt ? new Date(student.nextLesson.scheduledAt) : null
  const payments = paymentCounts(student)
  return (
    <Link
      to={`/teach/students/${student.id}`}
      className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <TeachAvatar name={student.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{student.name}</p>
          <p className="truncate text-xs text-muted-foreground">{student.email}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {next
          ? t('teacher.students.next', { when: fmt.whenShort(next) })
          : t('teacher.students.noNext')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {payments ? (
          <>
            {payments.unpaidDue > 0 ? (
              <TeachBadge tone="unpaid" icon={CircleAlert}>
                {t('teacher.students.unpaid', { count: payments.unpaidDue })}
              </TeachBadge>
            ) : null}
            <TeachBadge tone={payments.prepaidRemaining <= 1 ? 'warning' : 'credits'} icon={Ticket}>
              {payments.prepaidRemaining === 0
                ? t('teacher.students.noCredits')
                : t('teacher.students.credits', { count: payments.prepaidRemaining })}
            </TeachBadge>
          </>
        ) : student.toSchedule > 0 ? (
          <TeachBadge tone="neutral" icon={CalendarDays}>
            {t('teacher.students.toSchedule', { count: student.toSchedule })}
          </TeachBadge>
        ) : null}
      </div>
    </Link>
  )
}
