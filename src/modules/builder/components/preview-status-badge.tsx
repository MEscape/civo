import { AlertTriangle } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";

/**
 * Rendered by data-aware components when they are in editMode and not bound
 * to a real dataset (falling back to mock data).
 * 
 * Provides visual feedback to the builder that they are looking at sample
 * data, not real municipal data.
 */
export function PreviewStatusBadge({ datasetId }: { datasetId?: string }) {
    if (datasetId) return null;

    return (
        <Badge variant="warning" className="absolute right-2 top-2 z-10 opacity-80 pointer-events-none">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Beispieldaten
        </Badge>
    );
}
