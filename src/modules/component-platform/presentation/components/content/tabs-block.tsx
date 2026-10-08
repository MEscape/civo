import { Container, Section } from '@components/layout/layout-primitives';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

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
      <Container className="max-w-3xl">
        <Tabs defaultValue={FIRST_TAB}>
          <TabsList>
            {props.tabs.map((tab, index) => (
              <TabsTrigger key={`${String(index)}-${tab.label}`} value={`tab-${String(index)}`}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {props.tabs.map((tab, index) => (
            <TabsContent key={`${String(index)}-${tab.label}`} value={`tab-${String(index)}`}>
              {tab.body}
            </TabsContent>
          ))}
        </Tabs>
      </Container>
    </Section>
  );
}
