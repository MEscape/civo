import { Container, Section } from '@components/layout/layout-primitives';
import { Rail } from '@components/layout/rail';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';

import { trimToNull } from '@lib/utils';

import { Paragraphs } from '../shared/paragraphs';

import type { ComponentProps } from '../../../application/contracts/component-platform-constraints';

export interface AccordionBlockComponentProps {
  readonly props: ComponentProps<'accordion'>;
}

/** Collapsible questions and answers. */
export function AccordionBlock({ props }: AccordionBlockComponentProps) {
  if (props.items.length === 0) {
    return null;
  }
  const heading = trimToNull(props.heading);

  const accordion = (
    <div className="max-w-3xl">
      <Accordion type="single" collapsible>
        {props.items.map((item, index) => (
          <AccordionItem key={`${String(index)}-${item.question}`} value={`item-${String(index)}`}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>
              <Paragraphs
                text={item.answer}
                className="max-w-[var(--civo-measure)] text-base leading-relaxed text-copy"
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );

  return (
    <Section>
      <Container>
        {heading === null ? accordion : <Rail heading={heading}>{accordion}</Rail>}
      </Container>
    </Section>
  );
}
