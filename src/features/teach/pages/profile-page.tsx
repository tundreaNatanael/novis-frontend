import {
  Banknote,
  Building2,
  Check,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Phone,
  Sun,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import type { RouteHandle } from '@/app/route-handle'
import { useTheme, type ThemeSetting } from '@/app/theme'
import { useMe, useSession } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { TeachAvatar } from '../components/avatar'
import { Segmented } from '../components/form-controls'
import { IconBadge } from '../components/icon-badge'
import { ListRow, RowList } from '../components/list-row'
import { Section, TeachCard } from '../components/section'
import type { Locale } from '../i18n/types'
import { useI18n } from '../i18n/use-i18n'
import { teachCapabilities } from '../lib/capabilities'
import { useTeachTitle } from '../lib/use-teach-title'
import { useTeachSheets } from '../sheets/use-teach-sheets'

export const handle: RouteHandle = { title: 'Profile' }

const THEMES: { value: ThemeSetting; icon: LucideIcon }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

/** Profile: who, where (the school or freelance, the school's payments), the language and look, the password, sign out. */
export function Component() {
  const me = useMe()
  const { t, locale, setLocale } = useI18n()
  const { setting, setSetting } = useTheme()
  const { signOut } = useSession()
  const navigate = useNavigate()
  const sheets = useTeachSheets()
  const { canViewPayouts, place } = teachCapabilities(me)
  useTeachTitle(t('teacher.profile.title'))
  const school = place.kind === 'org' ? place.organization.name : null

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <TeachAvatar name={me.name} size="xl" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{me.name}</h1>
        <p className="text-sm text-muted-foreground">{me.email}</p>
        <p className="text-xs text-muted-foreground">{t('teacher.profile.signedInAs')}</p>
      </div>

      <Section title={t('teacher.profile.account')}>
        <TeachCard padded={false}>
          <RowList>
            <ListRow
              title={
                school
                  ? t('teacher.profile.school', { name: school })
                  : t('teacher.profile.freelance')
              }
              leading={<IconBadge icon={school ? Building2 : UserRound} />}
            />
            {canViewPayouts && school ? (
              <ListRow
                to="/teach/payments"
                title={t('teacher.payments.title', { school })}
                leading={<IconBadge icon={Banknote} tone="paid" />}
              />
            ) : null}
            <ListRow
              onClick={() => sheets.open({ kind: 'whatsapp' })}
              title={t('teacher.whatsapp.number')}
              subtitle={me.whatsappNumber ?? t('teacher.whatsapp.none')}
              leading={<IconBadge icon={Phone} />}
            />
            <ListRow
              onClick={() => sheets.open({ kind: 'password' })}
              title={t('teacher.profile.changePassword')}
              leading={<IconBadge icon={Lock} />}
            />
          </RowList>
        </TeachCard>
      </Section>

      <Section title={t('teacher.profile.preferences')}>
        <TeachCard className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{t('common.language')}</p>
            <Segmented<Locale>
              label={t('common.language')}
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'en', label: t('common.languages.en') },
                { value: 'ro', label: t('common.languages.ro') },
              ]}
              className="w-full max-w-xs"
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{t('common.theme')}</p>
            <Segmented<ThemeSetting>
              label={t('common.theme')}
              value={setting}
              onChange={setSetting}
              options={THEMES.map((option) => ({
                value: option.value,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <option.icon className="size-3.5" aria-hidden />
                    {t(`common.themes.${option.value}`)}
                    {setting === option.value ? <Check className="size-3.5" aria-hidden /> : null}
                  </span>
                ),
              }))}
              className="w-full max-w-sm"
            />
          </div>
        </TeachCard>
      </Section>

      <Button
        type="button"
        variant="destructive"
        size="lg"
        className="w-full rounded-full"
        onClick={() => {
          void signOut().then(() => navigate('/login', { replace: true }))
        }}
      >
        <LogOut aria-hidden />
        {t('common.signOut')}
      </Button>
    </div>
  )
}
