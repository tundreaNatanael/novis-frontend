import { X } from 'lucide-react'
import { SelectField, type SelectOption } from '@/components/form/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ListParams } from '@/lib/use-list-params'
import { useLessonFilterOptions } from '../hooks/use-lesson-filter-options'

export interface FixedScope {
  organizationId?: string
  teacherId?: string
}

/** Every `GET /lessons` filter, in the URL. Fixed parts (an organization or a teacher tab) are not shown. */
export function LessonFilters({ params, fixed }: { params: ListParams; fixed: FixedScope }) {
  const org = fixed.organizationId ?? params.filter('org')
  const teacherId = fixed.teacherId ?? params.filter('teacherId')
  const options = useLessonFilterOptions({ org: fixed.teacherId ? undefined : org, teacherId })

  const setScope = (value: string) =>
    params.set({ org: value || null, teacherId: null, studentId: null, courseId: null })
  const setTeacher = (value: string) =>
    params.set({ teacherId: value || null, studentId: null, courseId: null })
  const active = [
    'org',
    'teacherId',
    'studentId',
    'courseId',
    'status',
    'paid',
    'from',
    'to',
    'unscheduled',
  ].filter((key) => params.filter(key))

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!fixed.organizationId && !fixed.teacherId ? (
          <Filter label="Organization">
            {(id) => (
              <SelectField
                id={id}
                value={org ?? ''}
                onChange={setScope}
                options={options.scopes}
                placeholder={options.scopesLoading ? 'Loading…' : 'Any'}
              />
            )}
          </Filter>
        ) : null}
        {!fixed.teacherId ? (
          <Filter label="Teacher">
            {(id) => (
              <SelectField
                id={id}
                value={teacherId ?? ''}
                onChange={setTeacher}
                options={options.teachers}
                disabled={!options.teachersEnabled}
                placeholder={
                  !options.teachersEnabled
                    ? 'Choose an organization first'
                    : options.teachersLoading
                      ? 'Loading…'
                      : 'Any teacher'
                }
                emptyText="No teachers here."
              />
            )}
          </Filter>
        ) : null}
        <Filter label="Student">
          {(id) => (
            <SelectField
              id={id}
              value={params.filter('studentId') ?? ''}
              onChange={(value) => params.set({ studentId: value || null })}
              options={options.students}
              disabled={!options.studentsEnabled}
              placeholder={
                !options.studentsEnabled
                  ? 'Choose a teacher or organization first'
                  : options.studentsLoading
                    ? 'Loading…'
                    : 'Any student'
              }
              emptyText="No students here."
            />
          )}
        </Filter>
        <Filter label="Course">
          {(id) => (
            <SelectField
              id={id}
              value={params.filter('courseId') ?? ''}
              onChange={(value) => params.set({ courseId: value || null })}
              options={options.courses}
              disabled={!options.coursesEnabled}
              placeholder={
                !options.coursesEnabled
                  ? 'Choose a teacher or organization first'
                  : options.coursesLoading
                    ? 'Loading…'
                    : 'Any course'
              }
              emptyText="No courses here."
            />
          )}
        </Filter>
        <Filter label="Status">
          {(id) => (
            <SelectField
              id={id}
              value={params.filter('status') ?? ''}
              onChange={(value) => params.set({ status: value || null })}
              options={STATUS_OPTIONS}
              placeholder="Any status"
            />
          )}
        </Filter>
        <Filter label="Payment">
          {(id) => (
            <SelectField
              id={id}
              value={params.filter('paid') ?? ''}
              onChange={(value) => params.set({ paid: value || null })}
              options={[
                { value: 'true', label: 'Paid' },
                { value: 'false', label: 'Unpaid' },
              ]}
              placeholder="Paid or unpaid"
            />
          )}
        </Filter>
        <Filter label="Scheduled">
          {(id) => (
            <SelectField
              id={id}
              value={params.filter('unscheduled') ?? ''}
              onChange={(value) => params.set({ unscheduled: value || null })}
              options={[
                { value: 'false', label: 'Dated lessons only' },
                { value: 'true', label: 'Unscheduled only (credits)' },
              ]}
              placeholder="Dated and unscheduled"
            />
          )}
        </Filter>
        <div className="grid grid-cols-2 gap-2">
          <Filter label="From">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={params.filter('from') ?? ''}
                onChange={(e) => params.set({ from: e.target.value || null })}
              />
            )}
          </Filter>
          <Filter label="To">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={params.filter('to') ?? ''}
                onChange={(e) => params.set({ to: e.target.value || null })}
              />
            )}
          </Filter>
        </div>
      </div>
      {active.length > 0 ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              params.set({
                org: null,
                teacherId: null,
                studentId: null,
                courseId: null,
                status: null,
                paid: null,
                from: null,
                to: null,
                unscheduled: null,
              })
            }
          >
            <X aria-hidden />
            Clear filters
          </Button>
        </div>
      ) : null}
    </div>
  )
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'PENDING', label: 'Pending', description: 'Upcoming or not scheduled yet' },
  { value: 'PRESENT', label: 'Held' },
  { value: 'CANCELED', label: 'Canceled' },
  { value: 'CANCELED_LATE', label: 'Canceled late (charged)' },
]

function Filter({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = `lesson-filter-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children(id)}
    </div>
  )
}
