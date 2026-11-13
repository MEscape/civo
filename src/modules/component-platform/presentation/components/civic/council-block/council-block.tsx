import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';

import { getTranslations } from '@i18n/server';

import { stripHtml, trimToNull } from '@lib/utils';

import { ContentOriginBadge } from '../../shared/content-origin-badge';
import { ContentState } from '../../shared/content-state';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

export interface CouncilBlockComponentProps {
  readonly props: ComponentProps<'councilBlock'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
}

/** Council bodies with their member rosters. */
export async function CouncilBlock({ props, context, loadContent }: CouncilBlockComponentProps) {
  const [t, result] = await Promise.all([
    getTranslations('componentPlatform'),
    loadContent({
      kind: 'CouncilBody',
      mode: context.mode,
      websiteId: context.websiteId,
      datasetId: props.datasetId,
    }),
  ]);
  const heading = trimToNull(props.heading) ?? t('councilBlock.defaultHeading');

  if (result.isErr()) {
    return <ContentState kind="error" heading={heading} />;
  }
  const { items, origin } = result.value;
  if (items.length === 0) {
    return <ContentState kind="empty" heading={heading} />;
  }

  return (
    <Section className="relative">
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <ul className="flex flex-col gap-10">
          {items.map((body) => (
            <li key={body.id} className="@container border-t border-border pt-6">
              <h3 className="font-heading text-xl font-semibold text-copy">{body.name}</h3>
              {body.description !== undefined && (
                <p className="mt-1 max-w-[var(--civo-measure)] text-sm text-copy-muted">
                  {stripHtml(body.description)}
                </p>
              )}
              {body.members !== undefined && body.members.length > 0 && (
                <ul className="mt-5 gap-x-10 @xl:columns-2 @4xl:columns-3">
                  {body.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex break-inside-avoid items-start justify-between gap-3 border-b border-border py-3"
                    >
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <p className="text-base font-medium text-copy">{member.name}</p>
                        {member.role !== undefined && (
                          <p className="text-sm text-copy-muted">{member.role}</p>
                        )}
                      </div>
                      {member.party !== undefined && (
                        <Badge variant="muted" className="shrink-0">
                          {member.party}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Container>
      <ContentOriginBadge origin={origin} />
    </Section>
  );
}
