import { Container } from '@components/layout/layout-primitives';
import { ContentLink } from '@components/ui/content-link';
import { AlertOctagon, AlertTriangle, Info } from '@components/ui/icons';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

type AlertSeverity = 'info' | 'warning' | 'urgent';

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  urgent: AlertOctagon,
} as const satisfies Record<AlertSeverity, typeof Info>;

// Status tokens, not brand tokens: severity is a fixed semantic signal that
// must stay legible whatever a municipality's brand palette is.
const SEVERITY_CLASSES = {
  info: 'border-info-border bg-info-subtle text-info',
  warning: 'border-warning-border bg-warning-subtle text-warning',
  urgent: 'border-danger-border bg-danger-subtle text-danger',
} as const satisfies Record<AlertSeverity, string>;

export interface AlertBannerComponentProps {
  readonly props: ComponentProps<'alertBanner'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/**
 * Official notices. Site-level notices read as part of the page frame, so
 * an empty result renders nothing instead of an "empty" state.
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
    <div className="relative py-4">
      <ContentOriginBadge origin={origin} />
      <Container className="flex flex-col gap-3">
        {heading !== null && <h2 className="font-heading text-lg text-copy">{heading}</h2>}
        {items.map((alert) => {
          const Icon = SEVERITY_ICONS[alert.severity];

          return (
            <div
              key={alert.id}
              role={alert.severity === 'urgent' ? 'alert' : 'status'}
              className={`flex items-start gap-3 rounded-token border px-4 py-3 text-sm ${
                SEVERITY_CLASSES[alert.severity]
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">
                  {alert.href !== undefined ? (
                    <ContentLink href={alert.href} className="hover:underline">
                      {alert.title}
                    </ContentLink>
                  ) : (
                    alert.title
                  )}
                </p>
                {alert.message !== undefined && (
                  <p className="mt-0.5 opacity-90">{alert.message}</p>
                )}
              </div>
            </div>
          );
        })}
      </Container>
    </div>
  );
}
