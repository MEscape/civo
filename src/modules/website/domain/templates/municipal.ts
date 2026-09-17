import type { PageConfig, PageNode } from "@/modules/builder/domain/page-node";
import { type WebsiteTemplate, makeId, createNodeFromDefault } from "./types";

export const municipalTemplate: WebsiteTemplate = {
    key: "municipal",
    label: "Gemeinde / Stadt",
    description: "Startseite mit Hero, Neuigkeiten, Terminen, Leistungen und Kontakt.",
    generateHomePageConfig: (): PageConfig => {
        const children: PageNode[] = [
            createNodeFromDefault("alertBanner", makeId("municipal-alert", 0), {
                heading: "Wichtige Mitteilung",
            }),
            createNodeFromDefault("hero", makeId("municipal-hero", 1), {
                title: "Willkommen in Musterstadt",
                subtitle: "Gemeinsam digital gestalten",
            }),
            {
                ...createNodeFromDefault("section", makeId("municipal-section-1", 10), { tone: "default" }),
                children: [
                    createNodeFromDefault("serviceFinder", makeId("municipal-servicefinder", 2), {
                        heading: "Was erledige ich wo?",
                        placeholder: "Suchbegriff eingeben...",
                    }),
                    createNodeFromDefault("quickLinks", makeId("municipal-links", 11), {
                        heading: "Oft gesucht",
                    }),
                ],
            },
            {
                ...createNodeFromDefault("section", makeId("municipal-section-2", 20), { tone: "muted" }),
                children: [
                    createNodeFromDefault("newsAndEventsSplit", makeId("municipal-news-events", 3), {
                        heading: "Aktuelles aus der Stadt",
                        newsLimit: 4,
                        eventsLimit: 4,
                    }),
                ],
            },
            {
                ...createNodeFromDefault("section", makeId("municipal-section-3", 30), { tone: "default" }),
                children: [
                    createNodeFromDefault("departmentDirectory", makeId("municipal-directory", 4), {
                        heading: "Ansprechpartner & Ämter",
                    }),
                    createNodeFromDefault("wasteCalendar", makeId("municipal-waste", 5), {
                        heading: "Abfallkalender",
                    }),
                ],
            },
            {
                ...createNodeFromDefault("section", makeId("municipal-section-4", 40), { tone: "muted" }),
                children: [
                    createNodeFromDefault("contactCard", makeId("municipal-contact", 6), {
                        heading: "Kontakt Rathaus",
                    }),
                    createNodeFromDefault("openingHours", makeId("municipal-hours", 7), {
                        heading: "Öffnungszeiten Bürgerbüro",
                    }),
                ],
            },
        ];
        return { type: "page", children };
    },
};
