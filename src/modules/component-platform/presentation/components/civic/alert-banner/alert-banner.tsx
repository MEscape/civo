import { AlertOctagon, AlertTriangle, Info } from '@components/icons/icons';
import { Container } from '@components/layout/layout-primitives';
import { ContentLink } from '@components/ui/content-link';

import { getTranslations } from '@i18n/server';

import { cn, stripHtml, trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

type AlertSeverity = 'info' | 'warning' | 'urgent';

interface SeverityStyle {
  readonly Icon: typeof Info;
  /** Start-edge bar in the solid status colour, tinted fill. */
  readonly surface: string;
  readonly icon: string;
}

// Status tokens, not brand tokens: severity is a fixed semantic signal that
// must stay legible whatever a municipality's brand palette is. Class names
// are written out in full so Tailwind finds them.
const SEVERITY = {
  info: { Icon: Info, surface: 'border-s-info bg-info-subtle', icon: 'text-info' },
  warning: {
    Icon: AlertTriangle,
    surface: 'border-s-warning bg-warning-subtle',
    icon: 'text-warning',
  },
  urgent: {
    Icon: AlertOctagon,
    surface: 'border-s-danger bg-danger-subtle',
    icon: 'text-danger',
  },
} as const satisfies Record<AlertSeverity, SeverityStyle>;

export interface AlertBannerComponentProps {
  readonly props: ComponentProps<'alertBanner'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/**
 * Official notices. Site-level notices read as part of the page frame, so
 * an empty result renders nothing instead of an "empty" state.
 *
 * Severity is carried by four signals, none of them colour alone: the start
 * edge, the icon's shape, the live-region role, and a screen-reader label.
 */
export async function AlertBanner({ props, context, loadContent }: AlertBannerComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'Alert',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
      limit: props.limit,
    }),
  ]);
  const heading = trimToNull(props.heading);

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading ?? t('alertBanner.defaultHeading')} />;
  }
  const { items, origin } = result.value;
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="py-4">
      <Container className="flex flex-col gap-3">
        <ContentOriginBadge origin={origin} placement="inline" />
        {heading !== null && <h2 className="font-heading text-lg text-copy">{heading}</h2>}
        {items.map((alert) => {
          const { Icon, surface, icon } = SEVERITY[alert.severity];

          return (
            <div
              key={alert.id}
              role={alert.severity === 'urgent' ? 'alert' : 'status'}
              className={cn('flex items-start gap-3 rounded-e-token border-s-4 px-4 py-3', surface)}
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', icon)} aria-hidden="true" />
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="text-base font-semibold text-copy">
                  <span className="sr-only">
                    {t(`alertBanner.severity.${alert.severity}`)}
                    {'. '}
                  </span>
                  {alert.href !== undefined ? (
                    <ContentLink
                      href={alert.href}
                      className="underline decoration-1 underline-offset-4 hover:decoration-2"
                    >
                      {alert.title}
                    </ContentLink>
                  ) : (
                    alert.title
                  )}
                </p>
                {alert.message !== undefined && (
                  <p className="mt-0.5 text-sm text-copy-muted">{stripHtml(alert.message)}</p>
                )}
              </div>
            </div>
          );
        })}
      </Container>
    </div>
  );
}
