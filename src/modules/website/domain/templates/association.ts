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
            createNodeFromDefault("richText", makeId("assoc-richtext", 2), {
                heading: "Über uns",
                body: "Hier steht eine kurze Vorstellung des Vereins, seiner Geschichte und seiner Ziele.",
            }),
            createNodeFromDefault("newsGrid", makeId("assoc-news", 3), {
                columns: 3, limit: 3, heading: "Neuigkeiten",
            }),
            createNodeFromDefault("eventsGrid", makeId("assoc-events", 4), {
                columns: 3, limit: 3, heading: "Termine",
            }),
            createNodeFromDefault("contactCard", makeId("assoc-contact", 5), {
                heading: "Kontakt",
            }),
        ];
        return { type: "page", children };
    },
};
