import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

interface SelectFieldProps {
  id?: string
  value: string | undefined
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  /** Text shown inside the menu when `options` is empty. */
  emptyText?: string
  'aria-describedby'?: string | undefined
  'aria-invalid'?: boolean | undefined
}

/** A single-choice select for ids (teachers, courses, roles) with an empty-state line. */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  disabled,
  emptyText = 'Nothing to choose from yet.',
  ...a11y
}: SelectFieldProps) {
  return (
    <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full" {...a11y}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            <span className="flex flex-col items-start">
              <span>{option.label}</span>
              {option.description ? (
                <span className="text-xs text-muted-foreground">{option.description}</span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
