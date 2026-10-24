import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  customFrom,
  localTimeZone,
  periodDays,
  periodLabel,
  type PeriodChoice,
  type PeriodKind,
} from '../finance-period'

const OPTIONS: readonly (readonly [PeriodKind, string])[] = [
  ['this-month', 'This month'],
  ['previous-month', 'Previous month'],
  ['custom', 'Custom'],
]

interface PeriodPickerProps {
  value: PeriodChoice
  onChange: (next: PeriodChoice) => void
}

/**
 * This month (the default), the previous month or custom days, counted in the admin's own time
 * zone: an organization has none, so the console sends the period as instants (API.md §9.7).
 */
export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const label = periodLabel(value)
  const invalid = value.kind === 'custom' && periodDays(value) === null
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div
          className="inline-flex w-fit rounded-md border border-border bg-card p-0.5"
          role="group"
          aria-label="Period"
        >
          {OPTIONS.map(([kind, text]) => (
            <Button
              key={kind}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={value.kind === kind}
              onClick={() =>
                onChange(kind === 'custom' ? customFrom(value) : { kind, fromDay: '', toDay: '' })
              }
              className={cn(
                'h-11 md:h-7',
                value.kind === kind && 'bg-accent text-accent-foreground',
              )}
            >
              {text}
            </Button>
          ))}
        </div>
        {value.kind === 'custom' ? (
          <div className="flex flex-wrap items-start gap-3">
            <Field label="First day">
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  className="h-11 w-44 md:h-8"
                  value={value.fromDay}
                  onChange={(event) => onChange({ ...value, fromDay: event.target.value })}
                />
              )}
            </Field>
            <Field
              label="Last day"
              error={invalid ? 'Pick a first and a last day, in that order.' : undefined}
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  className="h-11 w-44 md:h-8"
                  value={value.toDay}
                  onChange={(event) => onChange({ ...value, toDay: event.target.value })}
                />
              )}
            </Field>
          </div>
        ) : null}
      </div>
      {label ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{label}</span>, in your time zone (
          {localTimeZone()})
        </p>
      ) : null}
    </div>
  )
}
