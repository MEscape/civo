"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectSelectedNode, selectSelectedNodeAncestors } from "@/modules/builder/application/builder-selectors";
import { updateNodePropsAction, commitPropsHistory, selectNode } from "@/modules/builder/application/document-slice";
import { getComponentDefinition } from "@/modules/component-platform/domain";
import { PropertyControl, PropertyField } from "@/modules/builder/components/property-controls";
import { ChevronRight } from "@/components/ui/icons";

/**
 * Properties panel (Phase 2 spec §17–19). Schema-driven: for the
 * selected node, reads `componentDefinition.fields` (the PropField
 * descriptors declared alongside each component's Zod schema — see
 * schemas/component-props-schema.ts) and renders exactly the controls
 * that component intentionally supports. Never exposes arbitrary CSS,
 * className, style, or HTML (spec §17) — a component that declares no
 * fields simply shows no editable properties.
 *
 * Property edits dispatch `updateNodePropsAction` on every keystroke
 * (fast local state, no server round-trip — spec §20) but only commit a
 * history entry via `commitPropsHistory` on blur/discrete-choice, so
 * typing a full sentence is one undo step, not one per character (spec
 * §23).
 */
export function PropertiesPanel() {
    const node = useAppSelector(selectSelectedNode);
    const ancestors = useAppSelector(selectSelectedNodeAncestors);

    if (!node) {
        return (
            <div className="p-4">
                <p className="text-sm text-[var(--civo-color-text-muted)]">
                    Komponente auswählen, um Eigenschaften zu bearbeiten.
                </p>
            </div>
        );
    }

    const definition = getComponentDefinition(node.type);

    return (
        <div className="p-4">
            {ancestors.length > 0 && <Breadcrumb ancestors={ancestors} currentLabel={definition?.label ?? node.type} />}

            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--civo-color-text-muted)]">
                Eigenschaften
            </h2>
            <p className="mb-4 text-sm font-medium text-[var(--civo-color-text)]">
                {definition?.label ?? node.type}
            </p>

            {definition && definition.fields.length > 0 ? (
                <div className="flex flex-col gap-4">
                    {definition.fields.map((field) => (
                        <FieldRow key={field.key} nodeId={node.id} field={field} value={node.props[field.key]} />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-[var(--civo-color-text-muted)]">
                    Diese Komponente hat keine bearbeitbaren Eigenschaften.
                </p>
            )}
        </div>
    );
}

function FieldRow({
    nodeId,
    field,
    value,
}: {
    nodeId: string;
    field: import("@/modules/component-platform/domain/types").PropField;
    value: unknown;
}) {
    const dispatch = useAppDispatch();

    return (
        <PropertyField field={field}>
            <PropertyControl
                field={field}
                value={value}
                onChange={(next) => dispatch(updateNodePropsAction({ nodeId, props: { [field.key]: next } }))}
                onCommit={() => dispatch(commitPropsHistory())}
            />
        </PropertyField>
    );
}

/** Component hierarchy breadcrumb for nested nodes (spec §37). */
function Breadcrumb({
    ancestors,
    currentLabel,
}: {
    ancestors: { id: string; type: string }[];
    currentLabel: string;
}) {
    const dispatch = useAppDispatch();
    return (
        <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-[var(--civo-color-text-muted)]">
            <button
                type="button"
                onClick={() => dispatch(selectNode(null))}
                className="hover:text-[var(--civo-color-text)] hover:underline"
            >
                Seite
            </button>
            {ancestors.map((ancestor) => {
                const def = getComponentDefinition(ancestor.type);
                return (
                    <span key={ancestor.id} className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        <button
                            type="button"
                            onClick={() => dispatch(selectNode(ancestor.id))}
                            className="hover:text-[var(--civo-color-text)] hover:underline"
                        >
                            {def?.label ?? ancestor.type}
                        </button>
                    </span>
                );
            })}
            <span className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <span className="text-[var(--civo-color-text)]">{currentLabel}</span>
            </span>
        </div>
    );
}
