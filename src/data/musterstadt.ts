import type {
    NewsItem,
    CivicEvent,
    Service,
    Contact,
    SmartCityMetric,
    OpeningHoursEntry,
    ServiceDetail,
    CouncilBody,
    WasteCollectionEntry,
    Alert,
    Department,
} from "@/modules/content/domain/content-types";

/**
 * Realistic demo content for the fictional municipality "Musterstadt".
 * Shared by the mock data provider (for local development / the builder
 * preview) and the Prisma seed script (for persisted demo websites).
 */

export const musterstadtNews: NewsItem[] = [
    {
        id: "news-1",
        title: "Neuer Radweg entlang der Uferpromenade eröffnet",
        slug: "neuer-radweg-uferpromenade",
        excerpt:
            "Der Ausbau des Radwegnetzes geht in die nächste Phase: Die neue Verbindung entlang der Uferpromenade verkürzt den Weg vom Bahnhof zur Altstadt deutlich.",
        content:
            "Der Ausbau des Radwegnetzes geht in die nächste Phase: Die neue Verbindung entlang der Uferpromenade verkürzt den Weg vom Bahnhof zur Altstadt deutlich. Der 2,3 Kilometer lange Abschnitt wurde mit Fördermitteln des Landes finanziert und schließt eine bislang gefährliche Lücke im Radwegenetz.",
        imageUrl: "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=800&q=80",
        publishedAt: new Date("2026-08-18"),
        category: "Mobilität",
    },
    {
        id: "news-2",
        title: "Bürgerhaushalt 2027: Jetzt Vorschläge einreichen",
        slug: "buergerhaushalt-2027",
        excerpt:
            "Musterstadt startet die Beteiligungsphase für den Bürgerhaushalt 2027. Bis zum 15. Oktober können Einwohnerinnen und Einwohner ihre Ideen einreichen.",
        content:
            "Musterstadt startet die Beteiligungsphase für den Bürgerhaushalt 2027. Bis zum 15. Oktober können Einwohnerinnen und Einwohner ihre Ideen einreichen. Ein Budget von 250.000 Euro steht für Bürgerprojekte zur Verfügung.",
        imageUrl: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80",
        publishedAt: new Date("2026-09-02"),
        category: "Verwaltung",
    },
    {
        id: "news-3",
        title: "Photovoltaik-Förderprogramm für Vereine gestartet",
        slug: "photovoltaik-foerderprogramm-vereine",
        excerpt:
            "Vereine und gemeinnützige Organisationen können ab sofort Zuschüsse für Photovoltaikanlagen auf Vereinsgebäuden beantragen.",
        content:
            "Vereine und gemeinnützige Organisationen können ab sofort Zuschüsse für Photovoltaikanlagen auf Vereinsgebäuden beantragen. Die Stadt übernimmt bis zu 40 Prozent der Installationskosten im Rahmen der Klimaschutzinitiative.",
        imageUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80",
        publishedAt: new Date("2026-08-27"),
        category: "Klimaschutz",
    },
    {
        id: "news-4",
        title: "Neues Familienzentrum im Stadtteil Nordstadt",
        slug: "familienzentrum-nordstadt",
        excerpt:
            "Ab September bietet das neue Familienzentrum in der Nordstadt Beratung, offene Treffs und Kursangebote für Familien mit kleinen Kindern.",
        imageUrl: "https://images.unsplash.com/photo-1544776193-2f74dfd97e91?w=800&q=80",
        publishedAt: new Date("2026-09-05"),
        category: "Familie",
    },
    {
        id: "news-5",
        title: "Wochenmarkt zieht für Sanierung auf den Rathausplatz um",
        slug: "wochenmarkt-umzug-rathausplatz",
        excerpt:
            "Während der Sanierung des Marktplatzes findet der Wochenmarkt ab dem 22. September übergangsweise auf dem Rathausplatz statt.",
        publishedAt: new Date("2026-09-08"),
        category: "Verwaltung",
    },
    {
        id: "news-6",
        title: "Stadtbücherei erweitert Öffnungszeiten am Samstag",
        slug: "stadtbuecherei-oeffnungszeiten",
        excerpt:
            "Ab Oktober ist die Stadtbücherei samstags bereits ab 9 Uhr statt bisher 10 Uhr geöffnet — eine Reaktion auf zahlreiche Bürgeranfragen.",
        publishedAt: new Date("2026-08-30"),
        category: "Kultur",
    },
];

export const musterstadtEvents: CivicEvent[] = [
    {
        id: "event-1",
        title: "Herbstmarkt auf dem Rathausplatz",
        description:
            "Regionale Erzeuger, Kunsthandwerk und ein Kinderprogramm rund um den historischen Rathausplatz.",
        startDate: new Date("2026-09-27T10:00:00"),
        endDate: new Date("2026-09-27T18:00:00"),
        location: "Rathausplatz",
        category: "Markt",
        imageUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
    },
    {
        id: "event-2",
        title: "Bürgersprechstunde des Oberbürgermeisters",
        description: "Offene Sprechstunde ohne Anmeldung, Themen jeder Art willkommen.",
        startDate: new Date("2026-09-24T16:00:00"),
        endDate: new Date("2026-09-24T18:00:00"),
        location: "Rathaus, Raum 1.12",
        category: "Verwaltung",
    },
    {
        id: "event-3",
        title: "Fahrrad-Codierung mit der Polizei",
        description: "Kostenlose Codierung gegen Fahrraddiebstahl in Zusammenarbeit mit dem Polizeipräsidium.",
        startDate: new Date("2026-10-03T09:00:00"),
        endDate: new Date("2026-10-03T13:00:00"),
        location: "Marktplatz",
        category: "Mobilität",
    },
    {
        id: "event-4",
        title: "Tag der offenen Tür: Feuerwehr Musterstadt",
        description: "Fahrzeugschau, Vorführungen und Informationen zur freiwilligen Feuerwehr.",
        startDate: new Date("2026-10-10T10:00:00"),
        endDate: new Date("2026-10-10T16:00:00"),
        location: "Feuerwache Nord",
        category: "Sicherheit",
        imageUrl: "https://images.unsplash.com/photo-1553864250-08542b5aa8dd?w=800&q=80",
    },
    {
        id: "event-5",
        title: "Info-Abend: Energetische Sanierung für Eigentümer",
        description: "Die Klimaschutzagentur informiert über Fördermöglichkeiten und Ablauf.",
        startDate: new Date("2026-10-14T18:30:00"),
        location: "Stadtbücherei, Vortragssaal",
        category: "Klimaschutz",
    },
];

export const musterstadtServices: Service[] = [
    { id: "svc-1", title: "Personalausweis beantragen", href: "/leistungen/personalausweis", icon: "id-card" },
    { id: "svc-2", title: "Wohnsitz anmelden", href: "/leistungen/wohnsitz-anmelden", icon: "home" },
    { id: "svc-3", title: "Kfz-Zulassung", href: "/leistungen/kfz-zulassung", icon: "car" },
    { id: "svc-4", title: "Bauantrag stellen", href: "/leistungen/bauantrag", icon: "hammer" },
    { id: "svc-5", title: "Termin online buchen", href: "/leistungen/termin-buchen", icon: "calendar" },
    { id: "svc-6", title: "Müllabfuhrtermine", href: "/leistungen/muellabfuhr", icon: "trash-2" },
];

export const musterstadtContacts: Contact[] = [
    {
        id: "contact-1",
        name: "Bürgerbüro",
        role: "Anmeldungen, Ausweise, Termine",
        email: "buergerbuero@musterstadt.de",
        phone: "+49 7541 000-100",
    },
    {
        id: "contact-2",
        name: "Bauamt",
        role: "Bauanträge, Stadtplanung",
        email: "bauamt@musterstadt.de",
        phone: "+49 7541 000-220",
    },
    {
        id: "contact-3",
        name: "Presse- und Öffentlichkeitsarbeit",
        role: "Medienanfragen",
        email: "presse@musterstadt.de",
        phone: "+49 7541 000-310",
    },
];

export const musterstadtOpeningHours: OpeningHoursEntry[] = [
    { day: "mon", opensAt: "08:00", closesAt: "16:00" },
    { day: "tue", opensAt: "08:00", closesAt: "16:00" },
    { day: "wed", opensAt: "08:00", closesAt: "12:30" },
    { day: "thu", opensAt: "08:00", closesAt: "18:00" },
    { day: "fri", opensAt: "08:00", closesAt: "12:30" },
    { day: "sat", closed: true },
    { day: "sun", closed: true },
];

export const musterstadtSmartCityMetrics: SmartCityMetric[] = [
    {
        id: "kpi-1",
        label: "CO₂-Reduktion ggü. 2020",
        value: 18.4,
        unit: "%",
        category: "sustainability",
        trend: "up",
        changePercent: 3.1,
    },
    {
        id: "kpi-2",
        label: "Radverkehrsanteil",
        value: 27,
        unit: "%",
        category: "mobility",
        trend: "up",
        changePercent: 2.4,
    },
    {
        id: "kpi-3",
        label: "Photovoltaik-Leistung",
        value: 4.2,
        unit: "MWp",
        category: "energy",
        trend: "up",
        changePercent: 12.5,
    },
    {
        id: "kpi-4",
        label: "Ladepunkte E-Mobilität",
        value: 58,
        unit: "Standorte",
        category: "mobility",
        trend: "up",
        changePercent: 9.0,
    },
    {
        id: "kpi-5",
        label: "Kommunaler Energieverbrauch",
        value: -6.8,
        unit: "% ggü. Vorjahr",
        category: "energy",
        trend: "down",
        changePercent: -6.8,
    },
    {
        id: "kpi-6",
        label: "Grünflächenanteil",
        value: 34,
        unit: "%",
        category: "sustainability",
        trend: "flat",
        changePercent: 0.2,
    },
];

export const musterstadtServiceDetails: ServiceDetail[] = [
    { id: "sd-1", title: "Personalausweis beantragen", href: "/services/ausweis", category: "Ausweise", icon: "CreditCard", department: "Bürgerbüro" },
    { id: "sd-2", title: "Wohnsitz ummelden", href: "/services/ummelden", category: "Meldewesen", icon: "Home", department: "Bürgerbüro" },
    { id: "sd-3", title: "Hundeanmeldung", href: "/services/hund", category: "Steuern", icon: "Dog", department: "Kämmerei" },
];

export const musterstadtCouncilBodies: CouncilBody[] = [
    {
        id: "cb-1",
        name: "Gemeinderat",
        description: "Oberstes Organ der Stadt",
        members: [
            { id: "m-1", name: "Erika Musterfrau", role: "Vorsitzende", party: "CDU" },
            { id: "m-2", name: "Max Mustermann", party: "SPD" }
        ]
    }
];

export const musterstadtWasteEntries: WasteCollectionEntry[] = [
    { id: "w-1", date: new Date(), wasteType: "restmuell", district: "Bezirk Mitte" },
    { id: "w-2", date: new Date(Date.now() + 86400000 * 2), wasteType: "biomuell", district: "Bezirk Nord" },
    { id: "w-3", date: new Date(Date.now() + 86400000 * 4), wasteType: "papier", district: "Alle Bezirke" },
    { id: "w-4", date: new Date(Date.now() + 86400000 * 7), wasteType: "gelberSack", district: "Bezirk Süd" },
];

export const musterstadtAlerts: Alert[] = [
    { id: "a-1", title: "Straßensperrung Hauptstraße", message: "Aufgrund von Bauarbeiten bis Freitag gesperrt.", severity: "warning", active: true },
    { id: "a-2", title: "Trinkwasserverunreinigung", message: "Bitte Wasser vor dem Verzehr abkochen.", severity: "urgent", active: true },
    { id: "a-3", title: "Neue Bürger-App verfügbar", severity: "info", active: true },
];

export const musterstadtDepartments: Department[] = [
    {
        id: "d-1",
        name: "Bürgerbüro",
        description: "Ihre erste Anlaufstelle für Ausweise und Meldewesen",
        href: "/aemter/buergerbuero",
        contacts: [
            { id: "c-1", name: "Petra Schmitz", email: "p.schmitz@musterstadt.de" },
            { id: "c-2", name: "Klaus Wagner", email: "k.wagner@musterstadt.de" }
        ]
    }
];
