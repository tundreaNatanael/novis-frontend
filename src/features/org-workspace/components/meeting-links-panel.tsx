import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { errorMessage } from '@/api/errors'
import { lessonKeys } from '@/api/lessons'
import { studentKeys, studentsApi } from '@/api/students'
import { teacherKeys } from '@/api/teacher'
import type { MeetingLink } from '@/api/types'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailField, DetailPanel } from '@/components/detail/detail-panel'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { httpsUrlSchema } from '@/lib/schemas'
import { isWhatsAppLink } from '@/lib/whatsapp'
import { useWorkspaceScope } from '../use-org-workspace'

const schema = z
  .object({ whatsapp: z.boolean(), meetingUrl: z.string() })
  .superRefine((values, ctx) => {
    // A WhatsApp call hides the link field: what it holds is not checked then.
    if (values.whatsapp) return
    const link = httpsUrlSchema.safeParse(values.meetingUrl)
    if (!link.success)
      ctx.addIssue({ code: 'custom', path: ['meetingUrl'], message: link.error.issues[0]?.message })
  })
type FormValues = z.infer<typeof schema>

/**
 * The student's teachers and the meeting link of each pair (D-057, `GET /students/{id}/meeting-links`):
 * how the student connects with that teacher, opened by every lesson of the two — a link, or a
 * WhatsApp call on the teacher's number (D-058). Set / Edit with `PUT …/meeting-links/{teacherId}`,
 * Remove with `DELETE`; both refresh the lessons.
 */
export function MeetingLinksPanel({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient()
  const links = useQuery({
    queryKey: studentKeys.meetingLinks(studentId),
    queryFn: ({ signal }) => studentsApi.meetingLinks(studentId, signal),
  })
  const [editing, setEditing] = useState<MeetingLink | null>(null)
  const [removing, setRemoving] = useState<MeetingLink | null>(null)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: studentKeys.meetingLinks(studentId) }),
      queryClient.invalidateQueries({ queryKey: lessonKeys.all }),
      queryClient.invalidateQueries({ queryKey: teacherKeys.roster() }),
    ])
  const remove = useMutation({
    mutationFn: (link: MeetingLink) => studentsApi.removeMeetingLink(studentId, link.teacherId),
    onSuccess: async () => {
      await refresh()
      toast.success('Meeting link removed')
      setRemoving(null)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <DetailPanel
      title="Meeting links"
      description="How the student connects with each teacher: a WhatsApp call, Meet or Zoom link. Every lesson of the two opens it."
    >
      {links.isPending ? (
        <DetailField label="Loading">…</DetailField>
      ) : links.isError ? (
        <DetailField label="Error">Could not load the meeting links.</DetailField>
      ) : links.data.length === 0 ? (
        <DetailField label="None">
          <span className="text-muted-foreground">
            No teacher of yours teaches this student yet.
          </span>
        </DetailField>
      ) : (
        links.data.map((link) => {
          const hasLink = link.whatsapp || link.meetingUrl !== null
          return (
            <DetailField key={link.teacherId} label={link.teacherName}>
              <span className="flex flex-wrap items-center gap-2">
                {link.whatsapp ? (
                  link.meetingUrl ? (
                    <a
                      href={link.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      WhatsApp call
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      WhatsApp call · no link until the teacher has a WhatsApp number
                    </span>
                  )
                ) : link.meetingUrl ? (
                  <a
                    href={link.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-primary underline-offset-4 hover:underline"
                  >
                    {isWhatsAppLink(link.meetingUrl) ? 'WhatsApp link' : link.meetingUrl}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(link)}
                  aria-label={`${hasLink ? 'Edit' : 'Set'} the meeting link with ${link.teacherName}`}
                >
                  {hasLink ? <Pencil aria-hidden /> : <Link2 aria-hidden />}
                  {hasLink ? 'Edit' : 'Set link'}
                </Button>
                {hasLink ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoving(link)}
                    aria-label={`Remove the meeting link with ${link.teacherName}`}
                  >
                    <Trash2 aria-hidden />
                    Remove
                  </Button>
                ) : null}
              </span>
            </DetailField>
          )
        })
      )}
      <MeetingLinkSheet
        studentId={studentId}
        link={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title="Remove the meeting link?"
        description={`Lessons with ${removing?.teacherName ?? 'this teacher'} will have no link to join until a new one is set.`}
        confirmLabel="Remove link"
        destructive
        onConfirm={() => (removing ? remove.mutateAsync(removing) : undefined)}
      />
    </DetailPanel>
  )
}

function MeetingLinkSheet({
  studentId,
  link,
  onOpenChange,
  onSaved,
}: {
  studentId: string
  link: MeetingLink | null
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<unknown>
}) {
  const scope = useWorkspaceScope()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { whatsapp: false, meetingUrl: '' },
  })
  useEffect(() => {
    if (link) {
      form.reset({
        whatsapp: link.whatsapp,
        meetingUrl: link.whatsapp ? '' : (link.meetingUrl ?? ''),
      })
      setFormError(null)
    }
  }, [link, form])
  const whatsapp = form.watch('whatsapp')
  const number = link?.teacherWhatsappNumber ?? null
  // Where the teacher's number is edited: their page in an organization, the freelance profile.
  const teacherHref =
    scope.kind === 'org' ? `${scope.basePath}/teachers/${link?.teacherId ?? ''}` : scope.basePath

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      studentsApi.setMeetingLink(
        studentId,
        link?.teacherId ?? '',
        values.whatsapp ? { whatsapp: true } : { meetingUrl: values.meetingUrl },
      ),
    onSuccess: async () => {
      await onSaved()
      toast.success('Meeting link saved')
      onOpenChange(false)
    },
    onError: (error) => setFormError(applyServerErrors(error, form.setError, ['meetingUrl'])),
  })

  return (
    <FormSheet
      open={link !== null}
      onOpenChange={onOpenChange}
      title={`Meeting link with ${link?.teacherName ?? ''}`}
      submitLabel="Save link"
      isSubmitting={save.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        save.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Controller
        control={form.control}
        name="whatsapp"
        render={({ field }) => (
          <div className="flex items-start gap-3 rounded-lg border border-border p-3">
            <Checkbox
              id="meeting-link-whatsapp"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              // Without a number it can only be turned off (a call set before the number was removed).
              disabled={!number && !field.value}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor="meeting-link-whatsapp" className="font-medium">
                WhatsApp call
              </Label>
              <p className="text-xs text-muted-foreground">
                {number ? (
                  `Every lesson of the two opens a WhatsApp chat with ${link?.teacherName ?? 'the teacher'}’s number, ${number}.`
                ) : (
                  <>
                    {link?.teacherName ?? 'The teacher'} has no WhatsApp number.{' '}
                    <Link
                      to={teacherHref}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Add it on their page
                    </Link>{' '}
                    to offer WhatsApp calls.
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      />
      {whatsapp ? null : (
        <Field
          label="Meeting link"
          required
          hint="A WhatsApp call link (WhatsApp → Calls → Create call link), Meet or Zoom. Every lesson of the two opens it."
          error={form.formState.errors.meetingUrl?.message}
        >
          {(a11y) => (
            <Input
              {...a11y}
              type="url"
              inputMode="url"
              autoFocus
              placeholder="https://"
              {...form.register('meetingUrl')}
            />
          )}
        </Field>
      )}
    </FormSheet>
  )
}
