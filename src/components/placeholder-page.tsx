import { PageHeader } from './page-header'

/** Temporary page for routes that a later phase fills in. */
export function PlaceholderPage({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={`This screen is built in phase ${phase}.`} />
    </div>
  )
}
