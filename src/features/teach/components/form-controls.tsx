import { Minus, Plus } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/use-i18n'
import { dayKey, fromDateTimeLocal, toDateTimeLocal } from '../lib/dates'

/** A whole number moved by buttons (a lesson's length, how many lessons), typed too. */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  hint?: string
}) {
  const t = useT()
  const id = useId()
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`${label}: ${t('common.previous')}`}
        >
          <Minus aria-hidden />
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(clamp(Math.round(next)))
          }}
          className="w-20 text-center tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label={`${label}: ${t('common.next')}`}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** A labelled switch with a hint, in a bordered row. */
export function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

/** A few exclusive choices in one control (the calendar's views, weekly / every two weeks). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex h-9 items-center gap-0.5 rounded-xl bg-muted p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-7 flex-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              selected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A local date and time (or a day) through the browser's own picker. */
export function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  hint,
  error,
  autoFocus,
}: {
  label: string
  value: Date
  onChange: (value: Date) => void
  mode?: 'datetime' | 'date'
  hint?: string
  error?: string
  autoFocus?: boolean
}) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={mode === 'date' ? 'date' : 'datetime-local'}
        value={mode === 'date' ? dayKey(value) : toDateTimeLocal(value)}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={(event) => {
          const next =
            mode === 'date'
              ? fromDateTimeLocal(`${event.target.value}T00:00`)
              : fromDateTimeLocal(event.target.value)
          if (next) onChange(next)
        }}
        className="w-fit min-w-56"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
