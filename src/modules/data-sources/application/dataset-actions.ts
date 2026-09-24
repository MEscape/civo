"use server";

import { revalidatePath } from "next/cache";
import { datasetService, type DatasetView, type CanonicalType } from "@/modules/data-sources/application/dataset-service";
import { type ActionResult, toActionResult } from "@/lib/actions/action-result";
import type { ConnectionDiagnosticCategory } from "@/modules/data-sources/domain/data-source-schema";
import type { DatasetMapping } from "@/modules/data-sources/domain/field-mapping-schema";

/**
 * Server Actions for Dataset management and mapping.
 *
 * Datasets are the primary handle components use to resolve external data.
 * This file owns everything Dataset-specific: CRUD, field mapping, and
 * live preview — keeping DataSource actions (data-source-actions.ts) focused
 * on connection-level concerns (test, discover, create/delete source).
 */

/* -------------------------------------------------------------------------- */
/* Selector — used by the dataset select field in the properties panel        */
/* -------------------------------------------------------------------------- */

/**
 * Lists datasets compatible with a component's declared canonicalType,
 * scoped to a website. Called client-side by DatasetSelectField on mount.
 */
export async function listCompatibleDatasetsAction(
    websiteId: string,
    canonicalType: CanonicalType
): Promise<ActionResult<DatasetView[]>> {
    return toActionResult(await datasetService.listCompatible(websiteId, canonicalType));
}

export async function listDataSourceDatasetsAction(
    dataSourceId: string,
    websiteId: string
): Promise<ActionResult<DatasetView[]>> {
    return toActionResult(await datasetService.listForDataSource(dataSourceId, websiteId));
}

/* -------------------------------------------------------------------------- */
/* CRUD                                                                       */
/* -------------------------------------------------------------------------- */

export async function createDatasetAction(input: {
    dataSourceId: string;
    name: string;
    slug: string;
    canonicalType: CanonicalType;
}, websiteId: string): Promise<ActionResult<DatasetView>> {
    const result = await datasetService.create(input, websiteId);

    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/settings`);
    }

    return toActionResult(result);
}

export async function updateDatasetAction(
    datasetId: string,
    input: { name?: string; slug?: string },
    websiteId: string
): Promise<ActionResult<DatasetView>> {
    const result = await datasetService.update(datasetId, input, websiteId);

    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/settings`);
    }

    return toActionResult(result);
}

export async function deleteDatasetAction(datasetId: string, websiteId: string): Promise<ActionResult<void>> {
    const result = await datasetService.delete(datasetId, websiteId);

    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/settings`);
        revalidatePath(`/websites/${websiteId}/builder`);
    }

    return toActionResult(result);
}

/* -------------------------------------------------------------------------- */
/* Mapping workflow                                                           */
/* -------------------------------------------------------------------------- */

export type DiscoverDatasetActionResult =
    | { ok: true; data: import("@/modules/data-sources/domain/data-source-adapter").DataDiscoveryResult }
    | { ok: false; category: ConnectionDiagnosticCategory; message: string };

export async function discoverDatasetAction(
    datasetId: string,
    websiteId: string
): Promise<DiscoverDatasetActionResult> {
    const result = await datasetService.discover(datasetId, websiteId);

    if (!result.ok) {
        return {
            ok: false,
            category: result.error.category,
            message: result.error.message,
        };
    }

    return { ok: true, data: result.data };
}

export async function previewDatasetMappingAction(
    datasetId: string,
    websiteId: string,
    mapping: DatasetMapping
): Promise<ActionResult<Record<string, unknown>>> {
    const result = await datasetService.previewMapping(datasetId, websiteId, mapping);

    if (!result.ok) {
        if (result.error.kind === "infrastructure") {
            return { ok: false, message: result.error.error.message };
        }
        return { ok: false, message: result.error.errors[0]?.message ?? "Das Mapping konnte nicht angewandt werden." };
    }

    return { ok: true, data: result.data };
}

export async function saveDatasetMappingAction(
    datasetId: string,
    mapping: DatasetMapping,
    websiteId: string
): Promise<ActionResult<DatasetView>> {
    const result = await datasetService.saveMapping(datasetId, mapping, websiteId);

    if (result.ok) {
        revalidatePath(`/websites/${websiteId}/settings`);
        revalidatePath(`/websites/${websiteId}/builder`);
    }

    return toActionResult(result);
}
