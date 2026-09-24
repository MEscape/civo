export function getMockPayload(path: string) {
    switch (path) {
        case "/news":
            return musterstadtExternalNews;
        case "/events":
            return musterstadtExternalEvents;
        case "/services":
            return musterstadtExternalServices;
        case "/contacts":
            return musterstadtExternalContacts;
        case "/opening-hours":
            return musterstadtExternalOpeningHours;
        case "/metrics":
            return musterstadtExternalSmartCityMetrics;
        case "/service-details":
            return musterstadtExternalServiceDetails;
        case "/council-bodies":
            return musterstadtExternalCouncilBodies;
        case "/waste":
            return musterstadtExternalWasteEntries;
        case "/alerts":
            return musterstadtExternalAlerts;
        case "/departments":
            return musterstadtExternalDepartments;
        default:
            return null;
    }
}

export const musterstadtExternalNews = [
    {
        "id": "news-1",
        "headline": "Neuer Radweg entlang der Uferpromenade eröffnet",
        "slug_url": "neuer-radweg-uferpromenade",
        "summary": "Der Ausbau des Radwegnetzes geht in die nächste Phase: Die neue Verbindung entlang der Uferpromenade verkürzt den Weg vom Bahnhof zur Altstadt deutlich.",
        "body_html": "Der Ausbau des Radwegnetzes geht in die nächste Phase: Die neue Verbindung entlang der Uferpromenade verkürzt den Weg vom Bahnhof zur Altstadt deutlich. Der 2,3 Kilometer lange Abschnitt wurde mit Fördermitteln des Landes finanziert und schließt eine bislang gefährliche Lücke im Radwegenetz.",
        "image": { "url": "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=800&q=80" },
        "date_published": "2026-08-18",
        "topic": "Mobilität"
    },
    {
        "id": "news-2",
        "headline": "Bürgerhaushalt 2027: Jetzt Vorschläge einreichen",
        "slug_url": "buergerhaushalt-2027",
        "summary": "Musterstadt startet die Beteiligungsphase für den Bürgerhaushalt 2027. Bis zum 15. Oktober können Einwohnerinnen und Einwohner ihre Ideen einreichen.",
        "body_html": "Musterstadt startet die Beteiligungsphase für den Bürgerhaushalt 2027. Bis zum 15. Oktober können Einwohnerinnen und Einwohner ihre Ideen einreichen. Ein Budget von 250.000 Euro steht für Bürgerprojekte zur Verfügung.",
        "image": { "url": "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&q=80" },
        "date_published": "2026-09-02",
        "topic": "Verwaltung"
    },
    {
        "id": "news-3",
        "headline": "Photovoltaik-Förderprogramm für Vereine gestartet",
        "slug_url": "photovoltaik-foerderprogramm-vereine",
        "summary": "Vereine und gemeinnützige Organisationen können ab sofort Zuschüsse für Photovoltaikanlagen auf Vereinsgebäuden beantragen.",
        "body_html": "Vereine und gemeinnützige Organisationen können ab sofort Zuschüsse für Photovoltaikanlagen auf Vereinsgebäuden beantragen. Die Stadt übernimmt bis zu 40 Prozent der Installationskosten im Rahmen der Klimaschutzinitiative.",
        "image": { "url": "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80" },
        "date_published": "2026-08-27",
        "topic": "Klimaschutz"
    },
    {
        "id": "news-4",
        "headline": "Neues Familienzentrum im Stadtteil Nordstadt",
        "slug_url": "familienzentrum-nordstadt",
        "summary": "Ab September bietet das neue Familienzentrum in der Nordstadt Beratung, offene Treffs und Kursangebote für Familien mit kleinen Kindern.",
        "image": { "url": "https://images.unsplash.com/photo-1544776193-2f74dfd97e91?w=800&q=80" },
        "date_published": "2026-09-05",
        "topic": "Familie"
    },
    {
        "id": "news-5",
        "headline": "Wochenmarkt zieht für Sanierung auf den Rathausplatz um",
        "slug_url": "wochenmarkt-umzug-rathausplatz",
        "summary": "Während der Sanierung des Marktplatzes findet der Wochenmarkt ab dem 22. September übergangsweise auf dem Rathausplatz statt.",
        "date_published": "2026-09-08",
        "topic": "Verwaltung"
    },
    {
        "id": "news-6",
        "headline": "Stadtbücherei erweitert Öffnungszeiten am Samstag",
        "slug_url": "stadtbuecherei-oeffnungszeiten",
        "summary": "Ab Oktober ist die Stadtbücherei samstags bereits ab 9 Uhr statt bisher 10 Uhr geöffnet — eine Reaktion auf zahlreiche Bürgeranfragen.",
        "date_published": "2026-08-30",
        "topic": "Kultur"
    }
];

export const musterstadtExternalEvents = [
    {
        "id": "event-1",
        "event_name": "Herbstmarkt auf dem Rathausplatz",
        "desc": "Regionale Erzeuger, Kunsthandwerk und ein Kinderprogramm rund um den historischen Rathausplatz.",
        "start": "2026-09-27T10:00:00",
        "end": "2026-09-27T18:00:00",
        "loc": "Rathausplatz",
        "type": "Markt",
        "img": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80"
    },
    {
        "id": "event-2",
        "event_name": "Bürgersprechstunde des Oberbürgermeisters",
        "desc": "Offene Sprechstunde ohne Anmeldung, Themen jeder Art willkommen.",
        "start": "2026-09-24T16:00:00",
        "end": "2026-09-24T18:00:00",
        "loc": "Rathaus, Raum 1.12",
        "type": "Verwaltung"
    },
    {
        "id": "event-3",
        "event_name": "Fahrrad-Codierung mit der Polizei",
        "desc": "Kostenlose Codierung gegen Fahrraddiebstahl in Zusammenarbeit mit dem Polizeipräsidium.",
        "start": "2026-10-03T09:00:00",
        "end": "2026-10-03T13:00:00",
        "loc": "Marktplatz",
        "type": "Mobilität"
    },
    {
        "id": "event-4",
        "event_name": "Tag der offenen Tür: Feuerwehr Musterstadt",
        "desc": "Fahrzeugschau, Vorführungen und Informationen zur freiwilligen Feuerwehr.",
        "start": "2026-10-10T10:00:00",
        "end": "2026-10-10T16:00:00",
        "loc": "Feuerwache Nord",
        "type": "Sicherheit",
        "img": "https://images.unsplash.com/photo-1553864250-08542b5aa8dd?w=800&q=80"
    },
    {
        "id": "event-5",
        "event_name": "Info-Abend: Energetische Sanierung für Eigentümer",
        "desc": "Die Klimaschutzagentur informiert über Fördermöglichkeiten und Ablauf.",
        "start": "2026-10-14T18:30:00",
        "loc": "Stadtbücherei, Vortragssaal",
        "type": "Klimaschutz"
    }
];

export const musterstadtExternalServices = [
    { "svc_id": "svc-1", "name": "Personalausweis beantragen", "url": "/leistungen/personalausweis", "icon_name": "id-card" },
    { "svc_id": "svc-2", "name": "Wohnsitz anmelden", "url": "/leistungen/wohnsitz-anmelden", "icon_name": "home" },
    { "svc_id": "svc-3", "name": "Kfz-Zulassung", "url": "/leistungen/kfz-zulassung", "icon_name": "car" },
    { "svc_id": "svc-4", "name": "Bauantrag stellen", "url": "/leistungen/bauantrag", "icon_name": "hammer" },
    { "svc_id": "svc-5", "name": "Termin online buchen", "url": "/leistungen/termin-buchen", "icon_name": "calendar" },
    { "svc_id": "svc-6", "name": "Müllabfuhrtermine", "url": "/leistungen/muellabfuhr", "icon_name": "trash-2" }
];

export const musterstadtExternalContacts = [
    { "id": "contact-1", "full_name": "Bürgerbüro", "position": "Anmeldungen, Ausweise, Termine", "email_addr": "buergerbuero@musterstadt.de", "tel": "+49 7541 000-100" },
    { "id": "contact-2", "full_name": "Bauamt", "position": "Bauanträge, Stadtplanung", "email_addr": "bauamt@musterstadt.de", "tel": "+49 7541 000-220" },
    { "id": "contact-3", "full_name": "Presse- und Öffentlichkeitsarbeit", "position": "Medienanfragen", "email_addr": "presse@musterstadt.de", "tel": "+49 7541 000-310" }
];

export const musterstadtExternalOpeningHours = [
    { "weekday": "mon", "open": "08:00", "close": "16:00" },
    { "weekday": "tue", "open": "08:00", "close": "16:00" },
    { "weekday": "wed", "open": "08:00", "close": "12:30" },
    { "weekday": "thu", "open": "08:00", "close": "18:00" },
    { "weekday": "fri", "open": "08:00", "close": "12:30" },
    { "weekday": "sat", "is_closed": true },
    { "weekday": "sun", "is_closed": true }
];

export const musterstadtExternalSmartCityMetrics = [
    {
        "kpi_id": "kpi-1", "source_lbl": "Beispieldaten (Demo)", "title": "CO₂-Reduktion ggü. 2020",
        "current_val": 18.4, "measure_unit": "%", "topic": "sustainability", "direction": "up", "pct_change": 3.1,
        "history": [{ "t": "2023-01", "v": 12.1 }, { "t": "2023-04", "v": 14.5 }, { "t": "2023-07", "v": 16.2 }, { "t": "2023-10", "v": 17.8 }, { "t": "2024-01", "v": 18.4 }],
        "segments": [{ "n": "Verkehr", "v": 45 }, { "n": "Gebäude", "v": 35 }, { "n": "Industrie", "v": 20 }],
        "goal": 25
    },
    { "kpi_id": "kpi-2", "source_lbl": "Beispieldaten (Demo)", "title": "Radverkehrsanteil", "current_val": 27, "measure_unit": "%", "topic": "mobility", "direction": "up", "pct_change": 2.4 },
    { "kpi_id": "kpi-3", "source_lbl": "Beispieldaten (Demo)", "title": "Photovoltaik-Leistung", "current_val": 4.2, "measure_unit": "MWp", "topic": "energy", "direction": "up", "pct_change": 12.5 },
    { "kpi_id": "kpi-4", "source_lbl": "Beispieldaten (Demo)", "title": "Ladepunkte E-Mobilität", "current_val": 58, "measure_unit": "Standorte", "topic": "mobility", "direction": "up", "pct_change": 9.0 },
    { "kpi_id": "kpi-5", "source_lbl": "Beispieldaten (Demo)", "title": "Kommunaler Energieverbrauch", "current_val": -6.8, "measure_unit": "% ggü. Vorjahr", "topic": "energy", "direction": "down", "pct_change": -6.8 },
    { "kpi_id": "kpi-6", "source_lbl": "Beispieldaten (Demo)", "title": "Grünflächenanteil", "current_val": 34, "measure_unit": "%", "topic": "sustainability", "direction": "flat", "pct_change": 0.2 }
];

export const musterstadtExternalServiceDetails = [
    { "id": "sd-1", "name": "Personalausweis beantragen", "url": "/services/ausweis", "group": "Ausweise", "icon_name": "CreditCard", "dept": "Bürgerbüro" },
    { "id": "sd-2", "name": "Wohnsitz ummelden", "url": "/services/ummelden", "group": "Meldewesen", "icon_name": "Home", "dept": "Bürgerbüro" },
    { "id": "sd-3", "name": "Hundeanmeldung", "url": "/services/hund", "group": "Steuern", "icon_name": "Dog", "dept": "Kämmerei" },
    { "id": "sd-4", "name": "Baugenehmigung", "url": "/services/bau", "group": "Bauen & Wohnen", "icon_name": "Hammer", "dept": "Bauamt" },
    { "id": "sd-5", "name": "Gewerbe anmelden", "url": "/services/gewerbe", "group": "Wirtschaft", "icon_name": "Briefcase", "dept": "Gewerbeamt" },
    { "id": "sd-6", "name": "Elterngeld beantragen", "url": "/services/elterngeld", "group": "Familie", "icon_name": "Baby", "dept": "Jugendamt" }
];

export const musterstadtExternalCouncilBodies = [
    {
        "id": "cb-1", "title": "Gemeinderat", "desc": "Oberstes Organ der Stadt", "people": [
            { "id": "m-1", "full_name": "Erika Musterfrau", "position": "Vorsitzende", "faction": "CDU" },
            { "id": "m-2", "full_name": "Max Mustermann", "faction": "SPD" },
            { "id": "m-3", "full_name": "Julia Sommer", "faction": "Grüne" },
            { "id": "m-4", "full_name": "Thomas Winter", "faction": "FDP" }
        ]
    },
    {
        "id": "cb-2", "title": "Bauausschuss", "desc": "Zuständig für Stadtentwicklung und Bauanträge", "people": [
            { "id": "m-5", "full_name": "Heinrich Weber", "position": "Vorsitzender", "faction": "SPD" },
            { "id": "m-6", "full_name": "Sarah Meyer", "faction": "CDU" }
        ]
    }
];

export const musterstadtExternalWasteEntries = [
    { "id": "w-1", "d": new Date().toISOString(), "type": "restmuell", "area": "Bezirk Mitte" },
    { "id": "w-2", "d": new Date(Date.now() + 86400000 * 2).toISOString(), "type": "biomuell", "area": "Bezirk Nord" },
    { "id": "w-3", "d": new Date(Date.now() + 86400000 * 4).toISOString(), "type": "papier", "area": "Alle Bezirke" },
    { "id": "w-4", "d": new Date(Date.now() + 86400000 * 7).toISOString(), "type": "gelberSack", "area": "Bezirk Süd" },
    { "id": "w-5", "d": new Date(Date.now() + 86400000 * 9).toISOString(), "type": "restmuell", "area": "Bezirk Nord" },
    { "id": "w-6", "d": new Date(Date.now() + 86400000 * 11).toISOString(), "type": "biomuell", "area": "Bezirk Mitte" },
    { "id": "w-7", "d": new Date(Date.now() + 86400000 * 14).toISOString(), "type": "gelberSack", "area": "Bezirk Nord" }
];

export const musterstadtExternalAlerts = [
    { "id": "a-1", "headline": "Straßensperrung Hauptstraße", "body": "Aufgrund von Bauarbeiten bis Freitag gesperrt.", "level": "warning", "is_active": true },
    { "id": "a-2", "headline": "Trinkwasserverunreinigung", "body": "Bitte Wasser vor dem Verzehr abkochen.", "level": "urgent", "is_active": true },
    { "id": "a-3", "headline": "Neue Bürger-App verfügbar", "level": "info", "is_active": true }
];

export const musterstadtExternalDepartments = [
    {
        "id": "d-1", "name": "Bürgerbüro", "desc": "Ihre erste Anlaufstelle für Ausweise und Meldewesen", "url": "/aemter/buergerbuero", "staff": [
            { "id": "c-1", "full_name": "Petra Schmitz", "email_addr": "p.schmitz@musterstadt.de", "tel": "07541 123-100" },
            { "id": "c-2", "full_name": "Klaus Wagner", "email_addr": "k.wagner@musterstadt.de", "tel": "07541 123-101" }
        ]
    },
    {
        "id": "d-2", "name": "Bauamt", "desc": "Ansprechpartner für Bauanträge, Bebauungspläne und Stadtentwicklung", "url": "/aemter/bauamt", "staff": [
            { "id": "c-3", "full_name": "Sabine Müller", "email_addr": "bauamt@musterstadt.de", "tel": "07541 123-200" }
        ]
    },
    {
        "id": "d-3", "name": "Standesamt", "desc": "Geburten, Eheschließungen, Sterbefälle", "url": "/aemter/standesamt", "staff": [
            { "id": "c-4", "full_name": "Michael Schmidt", "email_addr": "standesamt@musterstadt.de", "tel": "07541 123-300" }
        ]
    }
];

export const MOCK_DATASETS = [
    {
        slug: "ds-news",
        name: "Aktuelle Meldungen",
        canonicalType: "NewsItem",
        mapping: {
            id: "$.id",
            title: "$.headline",
            slug: "$.slug_url",
            excerpt: "$.summary",
            content: "$.body_html",
            imageUrl: "$.image.url",
            publishedAt: "$.date_published",
            category: "$.topic"
        },
        path: "/news"
    },
    {
        slug: "ds-events",
        name: "Veranstaltungen",
        canonicalType: "Event",
        mapping: {
            id: "$.id",
            title: "$.event_name",
            description: "$.desc",
            startDate: "$.start",
            endDate: "$.end",
            location: "$.loc",
            category: "$.type",
            imageUrl: "$.img"
        },
        path: "/events"
    },
    {
        slug: "ds-services",
        name: "Dienstleistungen",
        canonicalType: "Service",
        mapping: {
            id: "$.svc_id",
            title: "$.name",
            href: "$.url",
            icon: "$.icon_name"
        },
        path: "/services"
    },
    {
        slug: "ds-contacts",
        name: "Kontakte",
        canonicalType: "Contact",
        mapping: {
            id: "$.id",
            name: "$.full_name",
            role: "$.position",
            email: "$.email_addr",
            phone: "$.tel"
        },
        path: "/contacts"
    },
    {
        slug: "ds-opening-hours",
        name: "Öffnungszeiten",
        canonicalType: "OpeningHoursEntry",
        mapping: {
            day: "$.weekday",
            opensAt: "$.open",
            closesAt: "$.close",
            closed: "$.is_closed"
        },
        path: "/opening-hours"
    },
    {
        slug: "ds-metrics",
        name: "Smart-City-Kennzahlen",
        canonicalType: "SmartCityMetric",
        mapping: {
            id: "$.kpi_id",
            label: "$.title",
            value: "$.current_val",
            unit: "$.measure_unit",
            category: "$.topic",
            trend: "$.direction",
            changePercent: "$.pct_change",
            series: {
                _array: "$.history",
                date: "$.t",
                value: "$.v"
            },
            breakdown: {
                _array: "$.segments",
                label: "$.n",
                value: "$.v"
            },
            target: "$.goal"
        },
        path: "/metrics"
    },
    {
        slug: "ds-service-details",
        name: "Dienstleistungsdetails",
        canonicalType: "ServiceDetail",
        mapping: {
            id: "$.id",
            title: "$.name",
            href: "$.url",
            icon: "$.icon_name",
            category: "$.group",
            department: "$.dept"
        },
        path: "/service-details"
    },
    {
        slug: "ds-council",
        name: "Gremien",
        canonicalType: "CouncilBody",
        mapping: {
            id: "$.id",
            name: "$.title",
            description: "$.desc",
            members: {
                _array: "$.people",
                id: "$.id",
                name: "$.full_name",
                role: "$.position",
                party: "$.faction"
            }
        },
        path: "/council-bodies"
    },
    {
        slug: "ds-waste",
        name: "Abfallkalender",
        canonicalType: "WasteCollectionEntry",
        mapping: {
            id: "$.id",
            date: "$.d",
            wasteType: "$.type",
            district: "$.area"
        },
        path: "/waste"
    },
    {
        slug: "ds-alerts",
        name: "Warnungen",
        canonicalType: "Alert",
        mapping: {
            id: "$.id",
            title: "$.headline",
            message: "$.body",
            severity: "$.level",
            active: "$.is_active"
        },
        path: "/alerts"
    },
    {
        slug: "ds-departments",
        name: "Abteilungen",
        canonicalType: "Department",
        mapping: {
            id: "$.id",
            name: "$.name",
            description: "$.desc",
            href: "$.url",
            contacts: {
                _array: "$.staff",
                id: "$.id",
                name: "$.full_name",
                email: "$.email_addr",
                phone: "$.tel"
            }
        },
        path: "/departments"
    }
];
