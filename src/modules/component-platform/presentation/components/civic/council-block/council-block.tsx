import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Badge } from '@components/ui/badge';
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
      <ContentOriginBadge origin={origin} />
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <ul className="flex flex-col gap-6">
          {items.map((body) => (
            <li key={body.id}>
              <Card>
                <CardContent className="pt-5">
                  <h3 className="font-heading text-lg text-copy">{body.name}</h3>
                  {body.description !== undefined && (
                    <p className="mt-1 text-sm text-copy-muted">{body.description}</p>
                  )}
                  <ul className="mt-4 flex flex-col divide-y divide-border">
                    {body.members.map((member) => (
                      <li
                        key={member.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium text-copy">{member.name}</p>
                          {member.role !== undefined && (
                            <p className="text-xs text-copy-muted">{member.role}</p>
                          )}
                        </div>
                        {member.party !== undefined && (
                          <Badge variant="muted">{member.party}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
