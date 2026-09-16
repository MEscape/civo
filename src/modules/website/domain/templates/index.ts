import { municipalTemplate } from "./municipal";
import { smartCityTemplate } from "./smart-city";
import { associationTemplate } from "./association";
import type { TemplateKey, WebsiteTemplate } from "./types";

export type { TemplateKey, WebsiteTemplate };

const templates: Record<TemplateKey, WebsiteTemplate> = {
    municipal: municipalTemplate,
    "smart-city": smartCityTemplate,
    association: associationTemplate,
};

export function getTemplate(key: TemplateKey): WebsiteTemplate | undefined {
    return templates[key];
}

export function listTemplates(): WebsiteTemplate[] {
    return Object.values(templates);
}
