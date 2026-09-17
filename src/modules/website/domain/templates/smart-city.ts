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
            {
                ...createNodeFromDefault("section", makeId("smartcity-section-1", 10), { tone: "default" }),
                children: [
                    createNodeFromDefault("dashboardGrid", makeId("smartcity-dashboard", 2), {
                        heading: "Stadt in Zahlen",
                    }),
                ],
            },
            {
                ...createNodeFromDefault("section", makeId("smartcity-section-2", 20), { tone: "muted" }),
                children: [
                    createNodeFromDefault("kpiGrid", makeId("smartcity-kpis", 3), {
                        columns: 3, heading: "Aktuelle Kennzahlen",
                    }),
                    createNodeFromDefault("metricTrendChart", makeId("smartcity-trend", 4), {
                        heading: "Entwicklung",
                    }),
                ],
            },
            {
                ...createNodeFromDefault("section", makeId("smartcity-section-3", 30), { tone: "default" }),
                children: [
                    createNodeFromDefault("newsGrid", makeId("smartcity-news", 5), {
                        columns: 3, limit: 3, heading: "Aktuelle Projekte",
                    }),
                ],
            },
        ];
        return { type: "page", children };
    },
};
