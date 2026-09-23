"use server";

import { revalidatePath } from "next/cache";
import { dataSourceService, type DataSourceView } from "@/modules/data-sources/application/data-source-service";
import { type ActionResult, toActionResult } from "@/lib/actions/action-result";
import type {
    ConnectionDiagnosticCategory,
    DataSourceKind,
} from "@/modules/data-sources/domain/data-source-schema";
import type { DataDiscoveryResult } from "@/modules/data-sources/domain/data-source-adapter";

/**
 * Server Actions for the Data Sources settings area.
 *
 * A DataSource is a connection to an external system. Dataset management
 * (CRUD, mapping, preview) is handled in dataset-actions.ts.
 *
 * Flow: Client → Server Action → service (Zod + ownership) → repository
 */

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function listDataSourcesAction(websiteId: string): Promise<ActionResult<DataSourceView[]>> {
    return toActionResult(await dataSourceService.listForWebsite(websiteId));
}

export async function listDataSourcesWithDatasetsAction(websiteId: string): Promise<ActionResult<DataSourceView[]>> {
    return toActionResult(await dataSourceService.listForWebsiteWithDatasets(websiteId));
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createDataSourceAction(input: {
    websiteId: string;
    name: string;
    kind: DataSourceKind;
    config: Record<string, unknown>;
}): Promise<ActionResult<DataSourceView>> {
    const result = await dataSourceService.create(input);

    if (result.ok) {
        revalidatePath(`/websites/${input.websiteId}/settings`);
    }

    return toActionResult(result);
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteDataSourceAction(dataSourceId: string, websiteId: string): Promise<ActionResult<void>> {
    const result = await dataSourceService.delete(dataSourceId, websiteId);

    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/settings`);
    }

    return toActionResult(result);
}

/* -------------------------------------------------------------------------- */
/* Test connection                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Diagnostic-shaped result for "Test Connection".
 * Not `ActionResult<T>` because the settings UI needs the specific diagnostic category.
 */
export type TestConnectionActionResult =
    | { ok: true; statusCode: number; responseTimeMs: number }
    | { ok: false; category: ConnectionDiagnosticCategory; message: string };

export async function testDataSourceConnectionAction(
    dataSourceId: string,
    websiteId: string
): Promise<TestConnectionActionResult> {
    const result = await dataSourceService.testConnection(dataSourceId, websiteId);

    // Revalidate regardless of outcome — settings list shows status + last-checked after every attempt.
    revalidatePath(`/websites/${websiteId}/settings`);

    if (!result.ok) {
        return {
            ok: false,
            category: result.error.category,
            message: result.error.message,
        };
    }

    return {
        ok: true,
        statusCode: result.data.statusCode,
        responseTimeMs: result.data.responseTimeMs,
    };
}

/* -------------------------------------------------------------------------- */
/* Discovery (on a DataSource, not a Dataset)                                 */
/* -------------------------------------------------------------------------- */

export type DiscoverActionResult =
    | { ok: true; data: DataDiscoveryResult }
    | { ok: false; category: ConnectionDiagnosticCategory; message: string };

/**
 * Discovers available fields from a DataSource's endpoint.
 * websiteId is required to confirm ownership before reading live external data.
 */
export async function discoverDataSourceAction(dataSourceId: string, websiteId: string): Promise<DiscoverActionResult> {
    const result = await dataSourceService.discover(dataSourceId, websiteId);

    if (!result.ok) {
        return {
            ok: false,
            category: result.error.category,
            message: result.error.message,
        };
    }

    return {
        ok: true,
        data: result.data,
    };
}
