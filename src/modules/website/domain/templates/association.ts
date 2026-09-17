import type { PageConfig, PageNode } from "@/modules/builder/domain/page-node";
import { type WebsiteTemplate, makeId, createNodeFromDefault } from "./types";

export const associationTemplate: WebsiteTemplate = {
    key: "association",
    label: "Verein",
    description: "Startseite mit Hero, Vorstellung, Neuigkeiten, Terminen und Kontakt.",
    generateHomePageConfig: (): PageConfig => {
        const children: PageNode[] = [
            createNodeFromDefault("hero", makeId("assoc-hero", 1), {
                title: "Willkommen bei unserem Verein",
                subtitle: "Gemeinsam aktiv seit vielen Jahren",
            }),
            {
                ...createNodeFromDefault("section", makeId("assoc-section-1", 10), { tone: "default" }),
                children: [
                    createNodeFromDefault("richText", makeId("assoc-richtext", 2), {
                        heading: "Über uns",
                        body: "Hier steht eine kurze Vorstellung des Vereins, seiner Geschichte und seiner Ziele.",
                    }),
                    createNodeFromDefault("quickLinks", makeId("assoc-links", 11), {
                        heading: "Wichtige Links",
                    }),
                ],
            },
            {
                ...createNodeFromDefault("section", makeId("assoc-section-2", 20), { tone: "muted" }),
                children: [
                    createNodeFromDefault("newsAndEventsSplit", makeId("assoc-news-events", 3), {
                        heading: "Aktuelles & Termine",
                        newsLimit: 3,
                        eventsLimit: 3,
                    }),
                ],
            },
            {
                ...createNodeFromDefault("section", makeId("assoc-section-3", 30), { tone: "default" }),
                children: [
                    createNodeFromDefault("contactCard", makeId("assoc-contact", 5), {
                        heading: "Kontakt",
                    }),
                    createNodeFromDefault("openingHours", makeId("assoc-hours", 6), {
                        heading: "Öffnungszeiten Vereinsheim",
                    }),
                ],
            },
        ];
        return { type: "page", children };
    },
};
