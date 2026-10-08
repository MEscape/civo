import { Container, Section, SectionHeading } from '@components/layout/layout-primitives';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@components/ui/accordion';

import { trimToNull } from '@lib/utils';

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

  return (
    <Section>
      <Container className="max-w-3xl">
        {heading !== null && <SectionHeading>{heading}</SectionHeading>}
        <Accordion type="single" collapsible>
          {props.items.map((item, index) => (
            <AccordionItem
              key={`${String(index)}-${item.question}`}
              value={`item-${String(index)}`}
            >
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  );
}
