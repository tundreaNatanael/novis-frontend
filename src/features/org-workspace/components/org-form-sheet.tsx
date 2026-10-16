import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { isApiError } from '@/api/errors'
import { orgKeys, orgsApi } from '@/api/orgs'
import type { Organization } from '@/api/types'
import { Field } from '@/components/form/field'
import { FormError } from '@/components/form/form-error'
import { FormSheet } from '@/components/form/form-sheet'
import { applyServerErrors } from '@/components/form/server-errors'
import { Input } from '@/components/ui/input'
import { nameSchema, slugSchema } from '@/lib/schemas'
import { slugify } from '@/lib/slug'

const schema = z.object({ name: nameSchema, slug: slugSchema })
type FormValues = z.infer<typeof schema>

interface OrgFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set the sheet edits this organization; otherwise it creates one. */
  org?: Organization
  onSaved?: (org: Organization) => void
}

/** Create or edit an organization: name and slug (`POST /orgs`, `PATCH /orgs/{id}`). */
export function OrgFormSheet({ open, onOpenChange, org, onSaved }: OrgFormSheetProps) {
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(!!org)
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: org?.name ?? '', slug: org?.slug ?? '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ name: org?.name ?? '', slug: org?.slug ?? '' })
      setSlugEdited(!!org)
      setFormError(null)
    }
  }, [open, org, form])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      org ? orgsApi.update(org.id, values) : orgsApi.create(values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: orgKeys.lists() })
      if (org) await queryClient.invalidateQueries({ queryKey: orgKeys.detail(org.id) })
      toast.success(org ? 'Organization updated' : 'Organization created')
      onOpenChange(false)
      onSaved?.(saved)
    },
    onError: (error) => {
      if (isApiError(error) && error.isConflict) {
        form.setError('slug', {
          type: 'server',
          message: 'This slug is already taken. Choose another one.',
        })
        return
      }
      setFormError(applyServerErrors(error, form.setError, ['name', 'slug']))
    },
  })

  const name = form.watch('name')
  useEffect(() => {
    if (!org && !slugEdited)
      form.setValue('slug', slugify(name), { shouldValidate: form.formState.isSubmitted })
  }, [name, org, slugEdited, form])

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={org ? 'Edit organization' : 'New organization'}
      description={
        org
          ? 'The slug is part of links and must stay unique.'
          : 'A school on the platform. You can add admins and teachers once it exists.'
      }
      submitLabel={org ? 'Save changes' : 'Create organization'}
      isSubmitting={mutation.isPending}
      onSubmit={form.handleSubmit((values) => {
        setFormError(null)
        mutation.mutate(values)
      })}
    >
      <FormError message={formError} />
      <Field label="Name" required error={form.formState.errors.name?.message}>
        {(a11y) => (
          <Input
            {...a11y}
            autoFocus={!org}
            autoComplete="organization"
            {...form.register('name')}
          />
        )}
      </Field>
      <Field
        label="Slug"
        required
        hint="Lower-case letters, digits and single dashes; 2 to 100 characters. Unique across the platform."
        error={form.formState.errors.slug?.message}
      >
        {(a11y) => (
          <Input
            {...a11y}
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
            {...form.register('slug', { onChange: () => setSlugEdited(true) })}
          />
        )}
      </Field>
    </FormSheet>
  )
}
