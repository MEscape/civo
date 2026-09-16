import { tabsPropsSchema } from "./tabs-block.definition";
import { Section, Container } from "@/modules/builder/components/layout/layout-primitives";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function TabsBlock({ props }: { props: Record<string, unknown> }) {
    const parsed = tabsPropsSchema.safeParse(props);
    const { tabs } = parsed.success ? parsed.data : { tabs: [] };

    if (tabs.length === 0) return null;
    const firstValue = "tab-0";

    return (
        <Section>
            <Container className="max-w-3xl">
                <Tabs defaultValue={firstValue}>
                    <TabsList>
                        {tabs.map((tab, index) => (
                            <TabsTrigger key={`${tab.label}-${index}`} value={`tab-${index}`}>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {tabs.map((tab, index) => (
                        <TabsContent key={`${tab.label}-${index}`} value={`tab-${index}`}>
                            {tab.body}
                        </TabsContent>
                    ))}
                </Tabs>
            </Container>
        </Section>
    );
}
