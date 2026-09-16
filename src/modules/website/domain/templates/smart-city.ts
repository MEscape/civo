import type { PageConfig, PageNode } from "@/modules/builder/domain/page-node";
import { type WebsiteTemplate, makeId, createNodeFromDefault } from "./types";

export const smartCityTemplate: WebsiteTemplate = {
    key: "smart-city",
    label: "Smart City Portal",
    description: "Startseite mit KPI-Kacheln, Smart-City-Metriken, Neuigkeiten und Terminen.",
    generateHomePageConfig: (): PageConfig => {
        const children: PageNode[] = [
            createNodeFromDefault("hero", makeId("smartcity-hero", 1), {
                title: "Musterstadt Smart City",
                subtitle: "Daten und Fortschritt für eine lebenswerte Stadt",
            }),
            createNodeFromDefault("kpiGrid", makeId("smartcity-kpis", 2), {
                columns: 3, heading: "Stadt in Zahlen",
            }),
            createNodeFromDefault("newsGrid", makeId("smartcity-news", 3), {
                columns: 3, limit: 3, heading: "Aktuelles",
            }),
            createNodeFromDefault("eventsGrid", makeId("smartcity-events", 4), {
                columns: 3, limit: 3, heading: "Termine",
            }),
        ];
        return { type: "page", children };
    },
};
