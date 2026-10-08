import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import { ContentLink } from '@components/ui/content-link';
import { ArrowRight } from '@components/ui/icons';

import { getTranslations } from '@i18n/server';

import { trimToNull } from '@lib/utils';

import type { ComponentProps } from '../../../../application/contracts/component-platform-constraints';

export interface QuickLinksComponentProps {
  readonly props: ComponentProps<'quickLinks'>;
}

/** A short list of important links. */
export async function QuickLinks({ props }: QuickLinksComponentProps) {
  if (props.links.length === 0) {
    return null;
  }
  const t = await getTranslations('componentPlatform');
  const heading = trimToNull(props.heading) ?? t('quickLinks.defaultHeading');

  return (
    <Section tone="muted">
      <Container className="max-w-3xl">
        <SectionHeading>{heading}</SectionHeading>
        <ul className="divide-y divide-border">
          {props.links.map((link, index) => (
            <li key={`${String(index)}-${link.href}`}>
              <ContentLink
                href={link.href}
                className="flex items-center justify-between py-3 text-sm font-medium text-copy hover:text-primary-copy"
              >
                {link.label}
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </ContentLink>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
