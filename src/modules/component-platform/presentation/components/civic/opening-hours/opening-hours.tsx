import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardContent } from '@components/ui/card';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface OpeningHoursComponentProps {
  readonly props: ComponentProps<'openingHours'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** The general opening hours, one row per weekday. */
export async function OpeningHours({ props, context, loadContent }: OpeningHoursComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'OpeningHoursEntry',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('openingHours.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items, origin } = result.value;
  if (items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section className="relative">
      <ContentOriginBadge origin={origin} />
      <Container className="max-w-xl">
        <SectionHeading>{heading}</SectionHeading>
        <Card>
          <CardContent className="pt-5">
            <dl className="divide-y divide-border">
              {items.map((entry) => (
                <div key={entry.day} className="flex items-center justify-between py-2.5 text-sm">
                  <dt className="text-copy">{t(`openingHours.days.${entry.day}`)}</dt>
                  <dd className="text-copy-muted">
                    {entry.closed || entry.opensAt === undefined || entry.closesAt === undefined
                      ? t('openingHours.closed')
                      : t('openingHours.range', {
                          from: entry.opensAt,
                          to: entry.closesAt,
                        })}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </Container>
    </Section>
  );
}
