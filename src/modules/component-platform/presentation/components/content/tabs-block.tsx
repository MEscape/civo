import { Container, Section } from '@components/layout/layout-primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

import { Paragraphs } from '../shared/paragraphs';

import type { ComponentProps } from '../../../application/contracts/component-platform-constraints';

const FIRST_TAB = 'tab-0';

export interface TabsBlockComponentProps {
  readonly props: ComponentProps<'tabs'>;
}

/** Content organised in tabs. */
export function TabsBlock({ props }: TabsBlockComponentProps) {
  if (props.tabs.length === 0) {
    return null;
  }

  return (
    <Section>
      <Container>
        <div className="max-w-3xl">
          <Tabs defaultValue={FIRST_TAB}>
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              {props.tabs.map((tab, index) => (
                <TabsTrigger
                  key={`${String(index)}-${tab.label}`}
                  value={`tab-${String(index)}`}
                  className="max-w-full whitespace-normal [overflow-wrap:anywhere]"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {props.tabs.map((tab, index) => (
              <TabsContent
                key={`${String(index)}-${tab.label}`}
                value={`tab-${String(index)}`}
                className="mt-4"
              >
                <Paragraphs
                  text={tab.body}
                  className="max-w-[var(--civo-measure)] text-base leading-relaxed text-copy"
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </Container>
    </Section>
  );
}
