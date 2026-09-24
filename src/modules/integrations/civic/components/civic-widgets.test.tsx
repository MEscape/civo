import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ok, err } from "@/lib/result/result";
import { AppErrors } from "@/lib/errors/app-error";
import { PreviewCivicDataProvider } from "@/modules/integrations/civic/infrastructure/adapters/preview-civic-provider";
import {ServiceFinder} from "@/modules/integrations/civic/components/service-finder/service-finder";
import {OpeningHours} from "@/modules/integrations/civic/components/opening-hours/opening-hours";
import {DepartmentDirectory} from "@/modules/integrations/civic/components/department-directory/department-directory";
import {CouncilBlock} from "@/modules/integrations/civic/components/council-block/council-block";
import {EventsGrid} from "@/modules/integrations/civic/components/events-grid/events-grid";
import {ServiceGrid} from "@/modules/integrations/civic/components/service-grid/service-grid";
import {NewsGrid} from "@/modules/integrations/civic/components/news-grid/news-grid";
import {WasteCalendar} from "@/modules/integrations/civic/components/waste-calendar/waste-calendar";
import {ContactCard} from "@/modules/integrations/civic/components/contact-card/contact-card";
import {NewsAndEventsSplit} from "@/modules/integrations/civic/components/news-and-events-split/news-and-events-split";
import {AlertBanner} from "@/modules/integrations/civic/components/alert-banner/alert-banner";

// Every provider method the widgets call, all controllable per test.
const provider = {
    getNews: vi.fn(),
    getEvents: vi.fn(),
    getServices: vi.fn(),
    getContacts: vi.fn(),
    getOpeningHours: vi.fn(),
    getServiceDetails: vi.fn(),
    getCouncilBodies: vi.fn(),
    getWasteCollectionEntries: vi.fn(),
    getDepartments: vi.fn(),
    getAlerts: vi.fn(),
};
vi.mock("@/modules/integrations/civic/infrastructure/adapters", () => ({
    getCivicDataProvider: async () => provider,
}));
const logError = vi.fn();
vi.mock("@/lib/logger/logger", () => ({ logger: { error: (...a: unknown[]) => logError(...a), warn: vi.fn(), info: vi.fn() } }));

type Widget = (args: { props: Record<string, unknown>; editMode?: boolean }) => Promise<React.ReactElement | null>;
type Case = { name: string; widget: Widget; method: keyof typeof provider };

const CASES: Case[] = [
    { name: "ServiceFinder", widget: ServiceFinder as Widget, method: "getServiceDetails" },
    { name: "OpeningHours", widget: OpeningHours as Widget, method: "getOpeningHours" },
    { name: "DepartmentDirectory", widget: DepartmentDirectory as Widget, method: "getDepartments" },
    { name: "CouncilBlock", widget: CouncilBlock as Widget, method: "getCouncilBodies" },
    { name: "EventsGrid", widget: EventsGrid as Widget, method: "getEvents" },
    { name: "ServiceGrid", widget: ServiceGrid as Widget, method: "getServices" },
    { name: "NewsGrid", widget: NewsGrid as Widget, method: "getNews" },
    { name: "WasteCalendar", widget: WasteCalendar as Widget, method: "getWasteCollectionEntries" },
    { name: "ContactCard", widget: ContactCard as Widget, method: "getContacts" },
];

const mappedData: any = {};
import { beforeAll } from "vitest";
beforeAll(async () => {
    const p = new PreviewCivicDataProvider();
    mappedData.getServiceDetails = (await p.getServiceDetails() as any).data;
    mappedData.getOpeningHours = (await p.getOpeningHours() as any).data;
    mappedData.getDepartments = (await p.getDepartments() as any).data;
    mappedData.getCouncilBodies = (await p.getCouncilBodies() as any).data;
    mappedData.getEvents = (await p.getEvents() as any).data;
    mappedData.getServices = (await p.getServices() as any).data;
    mappedData.getNews = (await p.getNews() as any).data;
    mappedData.getWasteCollectionEntries = (await p.getWasteCollectionEntries() as any).data;
    mappedData.getContacts = (await p.getContacts() as any).data;
    mappedData.getAlerts = (await p.getAlerts() as any).data;
});

async function renderWidget(widget: Widget) {
    const ui = await widget({ props: {} });
    return render(<>{ui}</>);
}

beforeEach(() => {
    for (const fn of Object.values(provider)) fn.mockReset();
    logError.mockReset();
});

describe.each(CASES)("$name", ({ name, widget, method }) => {
    it("explains a data failure instead of vanishing, keeps its heading, and logs the cause server-side", async () => {
        provider[method].mockResolvedValue(err(AppErrors.internal(new Error("upstream timeout 503"))));
        const { container } = await renderWidget(widget);

        expect(container.querySelector('[data-widget-state="error"]'), `${name} error state`).not.toBeNull();
        expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
        expect(logError).toHaveBeenCalledTimes(1);
        expect(container.textContent).not.toMatch(/timeout|503|upstream|Error/);
    });

    it("says there is no data, in different words from an error, when the source returns an empty list", async () => {
        provider[method].mockResolvedValue(ok([]));
        const { container } = await renderWidget(widget);
        expect(container.querySelector('[data-widget-state="empty"]'), `${name} empty`).not.toBeNull();
        expect(container.querySelector('[data-widget-state="error"]')).toBeNull();
    });

    it("renders its content, with no fallback state, when data is present", async () => {
        provider[method].mockResolvedValue(ok(mappedData[method]));
        const { container } = await renderWidget(widget);
        expect(container.querySelector("[data-widget-state]"), `${name} healthy`).toBeNull();
        expect(container.textContent!.length).toBeGreaterThan(20);
    });
});

describe("NewsAndEventsSplit (two feeds)", () => {
    const failure = () => err(AppErrors.internal(new Error("boom")));

    it("shows an error when BOTH feeds fail", async () => {
        provider.getNews.mockResolvedValue(failure());
        provider.getEvents.mockResolvedValue(failure());
        const { container } = await renderWidget(NewsAndEventsSplit as Widget);
        expect(container.querySelector('[data-widget-state="error"]')).not.toBeNull();
        expect(logError).toHaveBeenCalledTimes(2);
    });

    it("shows an error, not 'empty', when one feed failed and the other is empty (an empty list is unproven if its sibling failed)", async () => {
        provider.getNews.mockResolvedValue(failure());
        provider.getEvents.mockResolvedValue(ok([]));
        const { container } = await renderWidget(NewsAndEventsSplit as Widget);
        expect(container.querySelector('[data-widget-state="error"]')).not.toBeNull();
    });

    it("keeps rendering the feed that loaded when the other one fails (graceful degradation)", async () => {
        provider.getNews.mockResolvedValue(failure());
        provider.getEvents.mockResolvedValue(ok(mappedData.getEvents));
        const { container } = await renderWidget(NewsAndEventsSplit as Widget);
        expect(container.querySelector("[data-widget-state]")).toBeNull();
        expect(container.textContent).toContain(mappedData.getEvents[0].title);
        expect(logError).toHaveBeenCalledTimes(1);
    });

    it("says 'empty' only when both feeds succeeded and are empty", async () => {
        provider.getNews.mockResolvedValue(ok([]));
        provider.getEvents.mockResolvedValue(ok([]));
        const { container } = await renderWidget(NewsAndEventsSplit as Widget);
        expect(container.querySelector('[data-widget-state="empty"]')).not.toBeNull();
    });
});

describe("AlertBanner (deliberately different rules)", () => {
    it("shows an error state, with a fallback heading, when the alert feed fails", async () => {
        provider.getAlerts.mockResolvedValue(err(AppErrors.internal(new Error("upstream timeout 503"))));
        const { container } = await renderWidget(AlertBanner as Widget);
        expect(container.querySelector('[data-widget-state="error"]')).not.toBeNull();
        expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
        expect(logError).toHaveBeenCalledTimes(1);
        expect(container.textContent).not.toMatch(/timeout|503|upstream|Error/);
    });

    it("renders NOTHING — not an empty state — when there are simply no active alerts: that is the normal, common case, not a problem to report", async () => {
        provider.getAlerts.mockResolvedValue(ok([]));
        const { container } = await renderWidget(AlertBanner as Widget);
        expect(container.querySelector("[data-widget-state]")).toBeNull();
        expect(container.firstChild).toBeNull();
    });

    it("renders its alerts normally when data is present", async () => {
        provider.getAlerts.mockResolvedValue(ok(mappedData.getAlerts));
        const { container } = await renderWidget(AlertBanner as Widget);
        expect(container.querySelector("[data-widget-state]")).toBeNull();
        expect(container.textContent!.length).toBeGreaterThan(5);
    });
});
