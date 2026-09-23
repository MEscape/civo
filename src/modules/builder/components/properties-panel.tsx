"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectSelectedNode, selectSelectedNodeAncestors, selectEditorMode } from "@/modules/builder/application/builder-selectors";
import { updateNodePropsAction, commitPropsHistory, selectNode } from "@/modules/builder/application/document-slice";
import { getComponentDefinition } from "@/modules/component-platform/domain";
import { PropertyControl, PropertyField } from "@/modules/builder/components/property-controls";
import { ChevronRight } from "@/components/ui/icons";
import type { PropField } from "@/modules/component-platform/domain/types";
import { hasCapability } from "@/modules/builder/domain/editor-capabilities";
import { CanonicalType } from "@/modules/data-sources/domain/dataset-schema";

const groupLabels = {
    data: "Daten",
    content: "Inhalt",
    appearance: "Darstellung",
} as const;

/**
 * Properties panel (Phase 2 spec §17–19; Phase 3 spec §25, §36–39).
 *
 * Schema-driven: reads `componentDefinition.fields` (PropField descriptors)
 * and renders exactly the controls that component intentionally supports.
 * Never exposes arbitrary CSS, className, style, or HTML — a component
 * that declares no fields shows no editable properties.
 *
 * In "municipality" editorMode, only the fields listed in
 * `definition.municipalFields` are shown (spec §36). These are keyed by
 * field.key and resolved from the same `definition.fields` array — no
 * duplicate descriptor is needed. Components that don't declare
 * `municipalFields` are content-only in municipality mode (no panel UI).
 *
 * Fields are rendered in groups ("Inhalt" / "Darstellung") when any field
 * has a `group` assigned (spec §25). Fields without a group fall into an
 * ungrouped section, preserving full backward-compat with Phase 2
 * definitions that predate the group concept.
 *
 * Property edits dispatch `updateNodePropsAction` on every keystroke
 * (fast local state) but only commit a history entry on blur/discrete-
 * choice (spec §23).
 */
export function PropertiesPanel({ websiteId }: { websiteId: string }) {
    const node = useAppSelector(selectSelectedNode);
    const ancestors = useAppSelector(selectSelectedNodeAncestors);
    const editorMode = useAppSelector(selectEditorMode);

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

    // Resolve which fields to show based on editor mode
    let fields: readonly PropField[] = [];
    if (definition) {
        if (editorMode === "municipality") {
            // Municipality mode: only show explicitly allow-listed fields
            const allowed = new Set(definition.municipalFields ?? []);
            fields = definition.fields.filter((f) => allowed.has(f.key));
        } else {
            // Internal mode: all fields
            fields = definition.fields;
        }
    }

    const showVisibilityToggle =
        hasCapability(editorMode, "toggleVisibility") && !!node;

    return (
        <div className="p-4">
            {ancestors.length > 0 && <Breadcrumb ancestors={ancestors} currentLabel={definition?.label ?? node.type} />}

            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--civo-color-text-muted)]">
                Eigenschaften
            </h2>
            <p className="mb-4 text-sm font-medium text-[var(--civo-color-text)]">
                {definition?.label ?? node.type}
            </p>

            {showVisibilityToggle && <VisibilityToggle nodeId={node.id} visible={node.props.visible !== false} />}

            {fields.length > 0 ? (
                <GroupedFields
                    nodeId={node.id}
                    fields={fields}
                    props={node.props}
                    websiteId={websiteId}
                    canonicalType={definition?.dataBinding?.canonicalType}
                />
            ) : (
                <p className="text-sm text-[var(--civo-color-text-muted)]">
                    Diese Komponente hat keine bearbeitbaren Eigenschaften.
                </p>
            )}
        </div>
    );
}

/**
 * Renders fields grouped by their `group` attribute. Fields without a group
 * are rendered first in an ungrouped cluster. Groups appear in
 * content → appearance order so data configuration is always at the top.
 */
function GroupedFields({
    nodeId,
    fields,
    props,
    websiteId,
    canonicalType,
}: {
    nodeId: string;
    fields: readonly PropField[];
    props: Record<string, unknown>;
    websiteId: string;
    canonicalType?: string;
}) {
    const ungrouped = fields.filter((f) => !f.group);
    const data = fields.filter((f) => f.group === "data");
    const content = fields.filter((f) => f.group === "content");
    const appearance = fields.filter((f) => f.group === "appearance");

    const hasGroups = data.length > 0 || content.length > 0 || appearance.length > 0;

    return (
        <div className="flex flex-col gap-6">
            {ungrouped.length > 0 && (
                <FieldList nodeId={nodeId} fields={ungrouped} props={props} websiteId={websiteId} canonicalType={canonicalType} />
            )}
            {hasGroups && data.length > 0 && (
                <FieldGroup label={groupLabels.data}>
                    <FieldList nodeId={nodeId} fields={data} props={props} websiteId={websiteId} canonicalType={canonicalType} />
                </FieldGroup>
            )}
            {hasGroups && content.length > 0 && (
                <FieldGroup label={groupLabels.content}>
                    <FieldList nodeId={nodeId} fields={content} props={props} websiteId={websiteId} canonicalType={canonicalType} />
                </FieldGroup>
            )}
            {hasGroups && appearance.length > 0 && (
                <FieldGroup label={groupLabels.appearance}>
                    <FieldList nodeId={nodeId} fields={appearance} props={props} websiteId={websiteId} canonicalType={canonicalType} />
                </FieldGroup>
            )}
        </div>
    );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--civo-color-text-muted)]">
                {label}
            </p>
            <div className="flex flex-col gap-4">{children}</div>
        </div>
    );
}

function FieldList({
    nodeId,
    fields,
    props,
    websiteId,
    canonicalType,
}: {
    nodeId: string;
    fields: readonly PropField[];
    props: Record<string, unknown>;
    websiteId: string;
    canonicalType?: string;
}) {
    return (
        <div className="flex flex-col gap-4">
            {fields.map((field) => (
                <FieldRow
                    key={field.key}
                    nodeId={nodeId}
                    field={field}
                    value={props[field.key]}
                    websiteId={websiteId}
                    canonicalType={field.canonicalType ?? canonicalType}
                />
            ))}
        </div>
    );
}

function FieldRow({
    nodeId,
    field,
    value,
    websiteId,
    canonicalType,
}: {
    nodeId: string;
    field: PropField;
    value: unknown;
    websiteId: string;
    canonicalType?: string;
}) {
    const dispatch = useAppDispatch();

    return (
        <PropertyField field={field}>
            <PropertyControl
                field={field}
                value={value}
                onChange={(next) => dispatch(updateNodePropsAction({ nodeId, props: { [field.key]: next } }))}
                onCommit={() => dispatch(commitPropsHistory())}
                websiteId={websiteId}
                canonicalType={canonicalType as CanonicalType}
            />
        </PropertyField>
    );
}

/**
 * Visibility toggle — allows the municipality editor to hide/show a
 * component without deleting it (spec §41). Rendered above the field list
 * so it's always reachable regardless of how many fields a component has.
 */
function VisibilityToggle({ nodeId, visible }: { nodeId: string; visible: boolean }) {
    const dispatch = useAppDispatch();
    return (
        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
            <input
                type="checkbox"
                checked={visible}
                onChange={(e) => {
                    dispatch(updateNodePropsAction({ nodeId, props: { visible: e.target.checked } }));
                    dispatch(commitPropsHistory());
                }}
                className="h-4 w-4 rounded accent-[var(--civo-color-accent)]"
                id={`visibility-${nodeId}`}
            />
            <span className="text-[var(--civo-color-text)]">Sichtbar</span>
        </label>
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
