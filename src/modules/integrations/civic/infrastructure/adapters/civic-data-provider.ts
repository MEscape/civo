import type { Result } from "@/lib/result/result";
import type { AppError } from "@/lib/errors/app-error";
import type {
    NewsItem,
    CivicEvent,
    Service,
    Contact,
    OpeningHoursEntry,
    ServiceDetail,
    CouncilBody,
    WasteCollectionEntry,
    Alert,
    Department,
} from "@/modules/content/domain/civic-types";

/**
 * The abstraction every civic-content-consuming component is built against.
 *
 * Components (NewsGrid, EventsGrid, ServiceGrid, ContactCard, …) never
 * talk to Prisma, fetch(), or any specific external API directly. They
 * receive already-adapted canonical data, typically fetched server-side
 * by a Server Component that obtains a provider via `getCivicDataProvider`.
 *
 * Implementations:
 *  - MockCivicDataProvider (src/modules/integrations/civic/infrastructure/adapters/mock-civic-provider.ts) —
 *    the only implementation wired up in the MVP.
 *  - Future: RestCivicDataProvider, etc.
 *    Each maps its own external shape into the canonical content types
 *    via src/modules/integrations/civic/infrastructure/adapters, validated against the Zod schemas in
 *    src/modules/content/domain/content-schema.ts before being returned.
 *
 * @see SmartCityDataProvider for KPI / metrics-related data.
 */
export interface CivicDataProvider {
    getNews(options?: {
        limit?: number;
        category?: string;
    }): Promise<Result<NewsItem[], AppError>>;

    getNewsBySlug(slug: string): Promise<Result<NewsItem | null, AppError>>;

    getEvents(options?: {
        limit?: number;
        category?: string;
    }): Promise<Result<CivicEvent[], AppError>>;

    getServices(options?: { limit?: number }): Promise<Result<Service[], AppError>>;

    getContacts(options?: { limit?: number }): Promise<Result<Contact[], AppError>>;

    getOpeningHours(): Promise<Result<OpeningHoursEntry[], AppError>>;

    getServiceDetails(options?: {
        category?: string;
    }): Promise<Result<ServiceDetail[], AppError>>;

    getCouncilBodies(): Promise<Result<CouncilBody[], AppError>>;

    getWasteCollectionEntries(options?: {
        district?: string;
        from?: Date;
    }): Promise<Result<WasteCollectionEntry[], AppError>>;

    getAlerts(options?: {
        activeOnly?: boolean;
    }): Promise<Result<Alert[], AppError>>;

    getDepartments(): Promise<Result<Department[], AppError>>;
}
