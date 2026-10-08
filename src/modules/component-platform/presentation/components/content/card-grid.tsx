import { Container, Grid, Section, SectionHeading } from '@components/layout/layout-primitives';
import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';

import { trimToNull } from '@lib/utils';

import type { ComponentProps } from '../../../application/contracts/component-platform-constraints';

export interface CardGridComponentProps {
  readonly props: ComponentProps<'cardGrid'>;
}

/** A freely configurable grid of cards. */
export function CardGrid({ props }: CardGridComponentProps) {
  if (props.cards.length === 0) {
    return null;
  }
  const heading = trimToNull(props.heading);

  return (
    <Section>
      <Container>
        {heading !== null && <SectionHeading>{heading}</SectionHeading>}
        <Grid as="ul" columns={props.columns}>
          {props.cards.map((card, index) => (
            <li key={`${String(index)}-${card.title}`}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    {card.href !== undefined ? (
                      <ContentLink href={card.href} className="hover:text-primary-copy">
                        {card.title}
                      </ContentLink>
                    ) : (
                      card.title
                    )}
                  </CardTitle>
                  {card.description !== undefined && (
                    <CardDescription>{card.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </li>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
