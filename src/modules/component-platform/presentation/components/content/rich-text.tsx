import { Container, Section } from '@components/layout/layout-primitives';

import { trimToNull } from '@lib/utils';

import type { ComponentProps } from '../../../application/contracts/component-platform-constraints';

export interface RichTextComponentProps {
  readonly props: ComponentProps<'richText'>;
}

/** A heading with running text. */
export function RichText({ props }: RichTextComponentProps) {
  const heading = trimToNull(props.heading);

  return (
    <Section>
      <Container className="max-w-3xl">
        {heading !== null && <h2 className="mb-4 font-heading text-2xl text-copy">{heading}</h2>}
        <p className="whitespace-pre-line text-base leading-relaxed text-copy">{props.body}</p>
      </Container>
    </Section>
  );
}
