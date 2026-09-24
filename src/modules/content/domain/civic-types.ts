/**
 * Canonical internal content model — civic domain.
 *
 * These types are the ONLY shapes UI components are allowed to depend on.
 * External data (REST, municipal/smart-city APIs, CMS, database
 * rows) is mapped into these shapes at the data-adapter boundary — see
 * `src/modules/integrations/civic/infrastructure/adapters`. Components
 * must never import provider-specific types.
 *
 *   External data ≠ internal data ≠ UI props
 */

export type NewsItem = {
    id: string;
    title: string;
    slug: string;
    excerpt?: string;
    content?: string;
    imageUrl?: string;
    publishedAt?: string;
    category?: string;
};

export type CivicEvent = {
    id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    location?: string;
    category?: string;
    imageUrl?: string;
};

export type Service = {
    id: string;
    title: string;
    description?: string;
    href: string;
    icon?: string;
};

export type Contact = {
    id: string;
    name: string;
    role?: string;
    email?: string;
    phone?: string;
};

export type OpeningHoursEntry = {
    day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    opensAt?: string; // "08:00"
    closesAt?: string; // "16:00"
    closed?: boolean;
};

export type ServiceDetail = Service & {
    category?: string;
    keywords?: string[];
    department?: string;
    processingNote?: string;
};

export type CouncilMember = {
    id: string;
    name: string;
    role?: string;
    party?: string;
};

export type CouncilBody = {
    id: string;
    name: string;
    description?: string;
    members: CouncilMember[];
};

export type WasteType = "restmuell" | "biomuell" | "papier" | "gelberSack" | "sperrmuell";

export type WasteCollectionEntry = {
    id: string;
    date: string;
    wasteType: WasteType;
    district?: string;
};

export type AlertSeverity = "info" | "warning" | "urgent";

export type Alert = {
    id: string;
    title: string;
    message?: string;
    severity: AlertSeverity;
    href?: string;
    active: boolean;
};

export type Department = {
    id: string;
    name: string;
    description?: string;
    href?: string;
    contacts: Contact[];
};
