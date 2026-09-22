import { notFound } from "next/navigation";
import { websiteService } from "@/modules/website/application/website-service";
import { pageService } from "@/modules/builder/application/page-service";
import { BuilderStoreProvider } from "@/modules/builder/application/builder-store-provider";
import { BuilderShell } from "@/modules/builder/components/builder-shell";
import { toDomainTheme } from "@/modules/website/domain/theme";
import "@/modules/component-platform/infrastructure/registry";

/**
 * Municipality editor route (Phase 3 spec §35–41).
 *
 * Identical server-side setup to the internal builder — loads the same
 * website + page config, renders the same BuilderShell — but passes
 * `editorMode="municipality"` so the Redux store is seeded with the
 * restricted capability set before any child component renders.
 *
 * The ONLY difference from /builder is that prop:
 *  - ComponentPalette shows only `municipallyEditable` components
 *  - PropertiesPanel shows only `municipalFields` per component
 *  - Drag-to-reorder is disabled (no "editStructure" capability)
 *  - Visibility toggle is still available ("toggleVisibility" capability)
 *
 * Authentication and role-based access control are out of scope for the
 * MVP (spec §46). In production, this route would be guarded at the
 * middleware/auth layer; for the MVP, navigating directly to this URL
 * activates the restricted editing experience.
 */
export default async function MunicipalityEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const websiteResult = await websiteService.getById(id);
    if (!websiteResult.ok) notFound();

    const pageResult = await pageService.getByWebsiteAndPath(id, "");
    if (!pageResult.ok) notFound();

    const configResult = await pageService.getValidatedConfig(pageResult.data);
    if (!configResult.ok) notFound();

    const theme = toDomainTheme(websiteResult.data.theme);

    return (
        <BuilderStoreProvider>
            <BuilderShell
                website={{ id: websiteResult.data.id, name: websiteResult.data.name, theme }}
                page={{ id: pageResult.data.id, title: pageResult.data.title }}
                initialChildren={configResult.data.children}
                editorMode="municipality"
            />
        </BuilderStoreProvider>
    );
}
