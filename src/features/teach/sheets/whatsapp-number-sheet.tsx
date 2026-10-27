import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useMe } from '@/auth/session'
import { Field } from '@/components/form/field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { whatsAppNumberChange } from '@/lib/whatsapp'
import { TeachSheet } from '../components/teach-sheet'
import { useChangeWhatsAppNumber } from '../data/mutations'
import { useT } from '../i18n/use-i18n'
import { describeError } from '../lib/error-message'
import { applyFieldErrors } from '../lib/form'
import { makeSchemas } from '../lib/schemas'
import type { TeachSheetRequest } from './sheet-types'
import { useTeachSheets } from './use-teach-sheets'

/**
 * `PATCH /users/{me} { whatsappNumber }` (D-056): the teacher's own number, which their students
 * open a WhatsApp chat with. Emptied → removed. Opened from Edit student (D-058), it opens that
 * sheet again once saved (`afterSave`).
 */
export function WhatsAppNumberSheet({
  afterSave,
  open,
  onOpenChange,
}: {
  afterSave?: TeachSheetRequest
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const me = useMe()
  const sheets = useTeachSheets()
  const change = useChangeWhatsAppNumber()
  const schema = useMemo(
    () => z.object({ whatsappNumber: makeSchemas(t).optionalWhatsAppNumber }),
    [t],
  )
  type FormValues = z.infer<typeof schema>
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { whatsappNumber: me.whatsappNumber ?? '' },
  })

  useEffect(() => {
    if (open) form.reset({ whatsappNumber: me.whatsappNumber ?? '' })
  }, [open, me.whatsappNumber, form])

  const submit = form.handleSubmit(async ({ whatsappNumber }) => {
    const body = whatsAppNumberChange(whatsappNumber, me.whatsappNumber)
    try {
      if (body.whatsappNumber !== undefined) {
        await change.mutateAsync(body.whatsappNumber)
        toast.success(
          body.whatsappNumber === null
            ? t('teacher.whatsapp.removed')
            : t('teacher.whatsapp.saved'),
        )
      }
      if (afterSave) sheets.open(afterSave)
      else onOpenChange(false)
    } catch (error) {
      if (!applyFieldErrors(error, form.setError, ['whatsappNumber']))
        toast.error(describeError(error, t))
    }
  })

  return (
    <TeachSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('teacher.whatsapp.title')}
      onSubmit={() => void submit()}
      footer={
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full sm:w-auto"
          disabled={change.isPending}
        >
          {change.isPending ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          {t('teacher.whatsapp.submit')}
        </Button>
      }
    >
      <Field
        label={t('teacher.whatsapp.number')}
        hint={t('teacher.whatsapp.hint')}
        error={form.formState.errors.whatsappNumber?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            placeholder={t('teacher.whatsapp.placeholder')}
            {...form.register('whatsappNumber')}
          />
        )}
      </Field>
    </TeachSheet>
  )
}
