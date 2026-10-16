import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.')
    }
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={() => void copy()}
      aria-label={copied ? 'Copied' : label}
      className={cn('text-muted-foreground', className)}
    >
      {copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
    </Button>
  )
}
