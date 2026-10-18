import type { ComponentType } from 'react';

import { ArtemisLogo } from '@components/brand/artemis-logo';
import { Calendar, Pencil, ShieldCheck } from '@components/ui/icons';
import type { IconProps } from '@components/ui/icons';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { APP_IDENTITY } from '@lib/config';

const FEATURES = [
  { key: 'builder', icon: Pencil },
  { key: 'booking', icon: Calendar },
  { key: 'releases', icon: ShieldCheck },
] as const satisfies ReadonlyArray<{ key: string; icon: ComponentType<IconProps> }>;

const RING_COUNT = 5;
const RING_STEP = 40;
const RING_RADII = Array.from({ length: RING_COUNT }, (_, index) => (index + 1) * RING_STEP);

/** Rings like the contour lines of a map: the page's one decoration, behind the content. */
function Contours() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 400 400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className="pointer-events-none absolute -right-24 -bottom-24 size-96 text-primary-foreground/10"
    >
      {RING_RADII.map((radius) => (
        <circle key={radius} cx="200" cy="200" r={radius} />
      ))}
    </svg>
  );
}

export interface AuthAsideProps {
  readonly locale: Locale;
}

/**
 * The brand side of the sign-in pages on a wide screen: what the platform is
 * for, in three lines, so the form is never alone on an empty page. A phone
 * has no room for it and shows the logo above the form instead.
 */
export async function AuthAside({ locale }: AuthAsideProps) {
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
      <ArtemisLogo
        variant="full"
        className="relative h-12 self-start"
        title={APP_IDENTITY.company}
      />

      <div className="relative max-w-md space-y-10">
        <div className="space-y-3">
          <p className="font-heading text-3xl leading-tight font-semibold">{t('shell.headline')}</p>
          <p className="text-primary-foreground/80">{t('shell.summary')}</p>
        </div>
        <ul className="space-y-6">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-token bg-primary-foreground/10">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="space-y-0.5">
                <p className="font-medium">{t(`shell.features.${key}.title`)}</p>
                <p className="text-sm text-primary-foreground/80">
                  {t(`shell.features.${key}.description`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-primary-foreground/70">
        {t('shell.byline', { product: APP_IDENTITY.name, company: APP_IDENTITY.company })}
      </p>
      <Contours />
    </aside>
  );
}
