import { Eye, EyeOff, RefreshCw } from 'lucide-react'
import { type ComponentProps, useState } from 'react'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { generatePassword } from '@/lib/password'

interface PasswordFieldProps extends Omit<
  ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange'
> {
  value: string
  onChange: (value: string) => void
  /** Offer a "Generate" button (for passwords an admin hands over). */
  generate?: boolean
}

/** Password input with show / hide, optional generator and copy. */
export function PasswordField({
  value,
  onChange,
  generate = false,
  className,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex items-center gap-1">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        autoComplete="new-password"
        spellCheck={false}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
      {generate ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            onChange(generatePassword())
            setVisible(true)
          }}
          aria-label="Generate a password"
        >
          <RefreshCw aria-hidden />
        </Button>
      ) : null}
      {value ? <CopyButton value={value} label="Copy password" className="size-9" /> : null}
    </div>
  )
}
