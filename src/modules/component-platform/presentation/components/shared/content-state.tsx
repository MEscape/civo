import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';

import { getTranslations } from '@i18n/server';

export interface ContentStateProps {
  readonly kind: 'empty' | 'error';
  readonly heading: string;
}

/**
 * What a data component shows instead of its content. The error carries no
 * detail: a visitor learns that the section is unavailable, not why.
 */
export async function ContentState({ kind, heading }: ContentStateProps) {
  const t = await getTranslations('componentPlatform');

  return (
    <Section>
      <Container>
        <SectionHeading>{heading}</SectionHeading>
        <p role="status" className="text-sm text-copy-muted">
          {kind === 'empty' ? t('states.empty') : t('render.sectionUnavailable')}
        </p>
      </Container>
    </Section>
  );
}
