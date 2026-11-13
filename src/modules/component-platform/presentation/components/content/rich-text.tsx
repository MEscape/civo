import { Container, Section } from '@components/layout/layout-primitives';
import { Rail } from '@components/layout/rail';

import { trimToNull } from '@lib/utils';

import { Paragraphs } from '../shared/paragraphs';

import type { ComponentProps } from '../../../application/contracts/component-platform-constraints';

export interface RichTextComponentProps {
  readonly props: ComponentProps<'richText'>;
}

/** A heading with running text, set to a readable measure. */
export function RichText({ props }: RichTextComponentProps) {
  const heading = trimToNull(props.heading);
  const body = (
    <Paragraphs
      text={props.body ?? ''}
      className="max-w-[var(--civo-measure)] text-base leading-relaxed text-copy"
    />
  );

  return (
    <Section>
      <Container>{heading === null ? body : <Rail heading={heading}>{body}</Rail>}</Container>
    </Section>
  );
}
