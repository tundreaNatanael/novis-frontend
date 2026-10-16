import { AlertTriangle, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StepState = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface Step {
  label: ReactNode
  state: StepState
  detail?: ReactNode
}

/** Progress of a multi-step create (account → course, student → enrollment) with precise outcomes. */
export function StepStatus({ steps }: { steps: Step[] }) {
  return (
    <ol
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
      aria-live="polite"
    >
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-2">
          <StepIcon state={step.state} />
          <div className="min-w-0">
            <p
              className={cn(
                'font-medium',
                step.state === 'failed' ? 'text-destructive' : 'text-foreground',
              )}
            >
              {step.label}
            </p>
            {step.detail ? <p className="text-xs text-muted-foreground">{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

function StepIcon({ state }: { state: StepState }) {
  const className = 'mt-0.5 size-4 shrink-0'
  switch (state) {
    case 'done':
      return <CheckCircle2 className={cn(className, 'text-success')} aria-label="Done" />
    case 'failed':
      return <AlertTriangle className={cn(className, 'text-destructive')} aria-label="Failed" />
    case 'running':
      return (
        <Loader2
          className={cn(className, 'animate-spin text-muted-foreground motion-reduce:animate-none')}
          aria-label="In progress"
        />
      )
    case 'skipped':
      return <Circle className={cn(className, 'text-muted-foreground/50')} aria-label="Skipped" />
    default:
      return <Circle className={cn(className, 'text-muted-foreground/70')} aria-label="Pending" />
  }
}
