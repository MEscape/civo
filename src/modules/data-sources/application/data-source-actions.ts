"use server";

import { revalidatePath } from "next/cache";
import {
    dataSourceService,
    type DataSourceRow,
} from "@/modules/data-sources/infrastructure/data-source-service";
import {
    ActionResult,
    toActionResult,
} from "@/lib/actions/action-result";
import type {
    ConnectionDiagnosticCategory,
    DataSourceDataset,
    DataSourceKind,
} from "@/modules/data-sources/domain/data-source-schema";
import type {
    DataDiscoveryResult,
} from "@/modules/data-sources/domain/data-source-adapter";
import type {
    DatasetMapping,
} from "@/modules/data-sources/domain/field-mapping-schema";

/**
 * Server Actions for the Data Sources settings area (Phase 3.5 spec §3).
 *
 * Every action validates via the service layer (which validates via Zod)
 * and never trusts client input directly.
 *
 * Flow:
 *
 * Client → Server Action → Zod/service → repository/adapter
 * → Prisma/external API → revalidate
 *
 * `testDataSourceConnectionAction` and
 * `discoverDataSourceAction` intentionally return their own small result
 * shapes instead of the generic `ActionResult<T>`.
 *
 * This preserves the diagnostic category required by the settings UI.
 */

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function listDataSourcesAction(
    websiteId: string
): Promise<ActionResult<DataSourceRow[]>> {
    return toActionResult(
        await dataSourceService.listForWebsite(websiteId)
    );
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
}): Promise<ActionResult<DataSourceRow>> {
    const result = await dataSourceService.upsert(input);

    if (result.ok) {
        revalidatePath(
            `/websites/${input.websiteId}/settings`
        );
    }

    return toActionResult(result);
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteDataSourceAction(
    dataSourceId: string,
    websiteId: string
): Promise<ActionResult<void>> {
    const result =
        await dataSourceService.delete(dataSourceId);

    if (result.ok) {
        revalidatePath(
            `/websites/${websiteId}/settings`
        );
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
    const result =
        await dataSourceService.testConnection(
            dataSourceId
        );

    // Revalidate regardless of outcome. The settings list displays
    // status and last-checked information after every test attempt.
    revalidatePath(
        `/websites/${websiteId}/settings`
    );

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

export async function discoverDataSourceAction(
    dataSourceId: string
): Promise<DiscoverActionResult> {
    const result =
        await dataSourceService.discover(dataSourceId);

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

export async function previewDataSourceMappingAction(
    dataSourceId: string,
    mapping: DatasetMapping
): Promise<PreviewMappingActionResult> {
    const result =
        await dataSourceService.previewMapping(
            dataSourceId,
            mapping
        );

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
            message:
                result.data.error[0]?.message ??
                "The mapping could not be applied.",
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
): Promise<ActionResult<DataSourceRow>> {
    const result =
        await dataSourceService.saveMapping({
            dataSourceId,
            mapping,
        });

    if (result.ok) {
        revalidatePath(
            `/websites/${websiteId}/settings`
        );

        revalidatePath(
            `/websites/${websiteId}/builder`
        );
    }

    return toActionResult(result);
}
