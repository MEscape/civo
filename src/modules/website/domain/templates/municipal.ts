import type { PageConfig, PageNode } from "@/modules/builder/domain/page-node";
import { type WebsiteTemplate, makeId, createNodeFromDefault } from "./types";

export const municipalTemplate: WebsiteTemplate = {
    key: "municipal",
    label: "Gemeinde / Stadt",
    description: "Startseite mit Hero, Neuigkeiten, Terminen, Leistungen und Kontakt.",
    generateHomePageConfig: (): PageConfig => {
        const children: PageNode[] = [
            createNodeFromDefault("hero", makeId("municipal-hero", 1), {
                title: "Willkommen in Musterstadt",
                subtitle: "Gemeinsam digital gestalten",
            }),
            createNodeFromDefault("newsGrid", makeId("municipal-news", 2), {
                columns: 3, limit: 3, heading: "Aktuelles",
            }),
            createNodeFromDefault("eventsGrid", makeId("municipal-events", 3), {
                columns: 3, limit: 3, heading: "Termine",
            }),
            createNodeFromDefault("serviceGrid", makeId("municipal-services", 4), {
                columns: 3, heading: "Online-Leistungen",
            }),
            createNodeFromDefault("contactCard", makeId("municipal-contact", 5), {
                heading: "Kontakt",
            }),
        ];
        return { type: "page", children };
    },
};
