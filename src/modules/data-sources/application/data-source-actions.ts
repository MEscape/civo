"use server";

import { revalidatePath } from "next/cache";
import { dataSourceService, type DataSourceView } from "@/modules/data-sources/application/data-source-service";
import { ActionResult, toActionResult } from "@/lib/actions/action-result";
import type {
    ConnectionDiagnosticCategory,
    DataSourceDataset,
    DataSourceKind,
} from "@/modules/data-sources/domain/data-source-schema";
import type { DataDiscoveryResult } from "@/modules/data-sources/domain/data-source-adapter";
import type { DatasetMapping } from "@/modules/data-sources/domain/field-mapping-schema";

/**
 * Server Actions for the Data Sources settings area (Phase 3.5 spec §3).
 *
 * Every action validates via the service layer (which validates via Zod
 * and checks the caller's access to `websiteId` — see
 * application/website-access-guard.ts) and never trusts client input
 * directly.
 *
 * Flow:
 *
 * Client → Server Action → website access + Zod/service → repository/adapter
 * → Prisma/external API → revalidate
 *
 * Every action that operates on a `dataSourceId` also takes `websiteId`
 * and passes both to the service, which confirms the data source
 * actually belongs to that website before doing anything else (spec §22,
 * §29 — never trust a client-supplied id to already be scoped
 * correctly). `discoverDataSourceAction` and
 * `previewDataSourceMappingAction` gained a `websiteId` parameter for
 * this reason; callers must be updated to pass it.
 *
 * `testDataSourceConnectionAction` and `discoverDataSourceAction`
 * intentionally return their own small result shapes instead of the
 * generic `ActionResult<T>`, to preserve the diagnostic category the
 * settings UI needs (spec §6).
 */

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function listDataSourcesAction(websiteId: string): Promise<ActionResult<DataSourceView[]>> {
    return toActionResult(await dataSourceService.listForWebsite(websiteId));
}

/* -------------------------------------------------------------------------- */
/* Upsert                                                                     */
/* -------------------------------------------------------------------------- */

export async function upsertDataSourceAction(input: {
    websiteId: string;
    name: string;
    kind: DataSourceKind;
    dataset: DataSourceDataset;
    config: Record<string, unknown>;
}): Promise<ActionResult<DataSourceView>> {
    const result = await dataSourceService.upsert(input);

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
 * Diagnostic-shaped result for "Test Connection" (spec §6).
 *
 * This is intentionally not `ActionResult<T>` because the settings UI
 * needs the specific diagnostic category.
 */
export type TestConnectionActionResult =
    | {
    ok: true;
    statusCode: number;
    responseTimeMs: number;
}
    | {
    ok: false;
    category: ConnectionDiagnosticCategory;
    message: string;
};

export async function testDataSourceConnectionAction(
    dataSourceId: string,
    websiteId: string
): Promise<TestConnectionActionResult> {
    const result = await dataSourceService.testConnection(dataSourceId, websiteId);

    // Revalidate regardless of outcome. The settings list displays
    // status and last-checked information after every test attempt.
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
/* Discovery                                                                  */
/* -------------------------------------------------------------------------- */

export type DiscoverActionResult =
    | {
    ok: true;
    data: DataDiscoveryResult;
}
    | {
    ok: false;
    category: ConnectionDiagnosticCategory;
    message: string;
};

/**
 * `websiteId` is required (not just `dataSourceId`) so the service can
 * confirm the data source belongs to that website before running
 * discovery against it — discovery reads live external data, so an
 * unscoped `dataSourceId` here would let any caller read another
 * website's configured source.
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

/* -------------------------------------------------------------------------- */
/* Preview mapping                                                            */
/* -------------------------------------------------------------------------- */

export type PreviewMappingActionResult =
    | {
    ok: true;
    value: Record<string, unknown>;
}
    | {
    ok: false;
    message: string;
};

/**
 * `websiteId` is required for the same reason as `discoverDataSourceAction`
 * — previewing a mapping fetches live data from the configured source.
 */
export async function previewDataSourceMappingAction(
    dataSourceId: string,
    websiteId: string,
    mapping: DatasetMapping
): Promise<PreviewMappingActionResult> {
    const result = await dataSourceService.previewMapping(dataSourceId, websiteId, mapping);

    /*
     * Outer Result:
     *
     * Result<
     *     Result<Record<string, unknown>, MappingFieldError[]>,
     *     DataSourceError
     * >
     *
     * Therefore:
     *
     * result.error       -> DataSourceError
     * result.data        -> inner Result
     */
    if (!result.ok) {
        return {
            ok: false,
            message: result.error.message,
        };
    }

    /*
     * Inner Result:
     *
     * Result<Record<string, unknown>, MappingFieldError[]>
     *
     * Therefore:
     *
     * result.data.error -> MappingFieldError[]
     * result.data.data  -> Record<string, unknown>
     */
    if (!result.data.ok) {
        return {
            ok: false,
            message: result.data.error[0]?.message ?? "The mapping could not be applied.",
        };
    }

    return {
        ok: true,
        value: result.data.data,
    };
}

/* -------------------------------------------------------------------------- */
/* Save mapping                                                               */
/* -------------------------------------------------------------------------- */

export async function saveDataSourceMappingAction(
    dataSourceId: string,
    mapping: DatasetMapping,
    websiteId: string
): Promise<ActionResult<DataSourceView>> {
    const result = await dataSourceService.saveMapping({ dataSourceId, mapping }, websiteId);

    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/settings`);
        revalidatePath(`/websites/${websiteId}/builder`);
    }

    return toActionResult(result);
}
