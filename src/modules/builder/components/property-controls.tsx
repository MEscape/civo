"use client";

import type { PropField } from "@/modules/component-platform/domain";
import type { CanonicalType } from "@/modules/data-sources/application/dataset-service";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils/cn";
import { DatasetSelectField } from "./dataset-select-field";

/**
 * Reusable, controlled property controls (Phase 2 spec §19). Each
 * control only ever emits values from a known, bounded set (an enum
 * option, a column count 1–4, a number, plain text) — never arbitrary
 * CSS, className, or style objects (spec §17). One component per control
 * type, shared across every property field in the inspector, rather than
 * a bespoke input built per component.
 */

type ControlProps = {
    field: PropField;
    value: unknown;
    onChange: (value: unknown) => void;
    onCommit: () => void;
    websiteId?: string;
    canonicalType?: CanonicalType;
};

export function PropertyControl({ field, value, onChange, onCommit, websiteId, canonicalType }: ControlProps) {
    switch (field.control) {
        case "dataset":
            return (
                <DatasetSelectField
                    id={`prop-${field.key}`}
                    value={value}
                    onChange={onChange}
                    onCommit={onCommit}
                    websiteId={websiteId}
                    canonicalType={canonicalType}
                />
            );
        case "text":
            return (
                <Input
                    id={`prop-${field.key}`}
                    type="text"
                    value={typeof value === "string" ? value : ""}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onCommit}
                />
            );
        case "textarea":
            return (
                <Textarea
                    id={`prop-${field.key}`}
                    value={typeof value === "string" ? value : ""}
                    placeholder={field.placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onCommit}
                />
            );
        case "number":
            return (
                <Input
                    id={`prop-${field.key}`}
                    type="number"
                    value={typeof value === "number" ? value : ""}
                    onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                    onBlur={onCommit}
                />
            );
        case "select":
                <Select
                    value={String(value ?? "")}
                    onValueChange={(val) => {
                        onChange(val);
                        onCommit();
                    }}
                >
                    <SelectTrigger id={`prop-${field.key}`} className="w-full h-9">
                        <SelectValue placeholder="Auswählen…" />
                    </SelectTrigger>
                    <SelectContent>
                        {field.options?.map((option) => (
                            <SelectItem key={String(option.value)} value={String(option.value)}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
        case "columns":
            return (
                <div role="group" aria-label={field.label} className="flex gap-1">
                    {[1, 2, 3, 4].map((count) => (
                        <button
                            key={count}
                            type="button"
                            aria-pressed={value === count}
                            onClick={() => {
                                onChange(count);
                                onCommit();
                            }}
                            className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-token-sm border text-sm font-medium",
                                value === count
                                    ? "border-accent bg-accent text-accent-foreground"
                                    : "border-border-strong bg-surface text-copy hover:border-secondary"
                            )}
                        >
                            {count}
                        </button>
                    ))}
                </div>
            );
        case "switch":
            return (
                <Switch
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => {
                        onChange(checked);
                        onCommit();
                    }}
                />
            );
        default:
            return null;
    }
}

export function PropertyField({ field, children }: { field: PropField; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={`prop-${field.key}`}>{field.label}</Label>
            {children}
        </div>
    );
}
