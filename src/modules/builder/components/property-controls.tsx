"use client";

import type { PropField } from "@/modules/component-platform/domain";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

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
};

export function PropertyControl({ field, value, onChange, onCommit }: ControlProps) {
    switch (field.control) {
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
            return (
                <select
                    id={`prop-${field.key}`}
                    value={String(value ?? "")}
                    onChange={(e) => {
                        onChange(e.target.value);
                        onCommit();
                    }}
                    className="h-9 w-full rounded-[calc(var(--civo-radius)_-_2px)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] px-2 text-sm text-[var(--civo-color-text)] focus-visible:outline-2 focus-visible:outline-[var(--civo-color-accent)]"
                >
                    <option value="" disabled>
                        Auswählen…
                    </option>
                    {field.options?.map((option) => (
                        <option key={String(option.value)} value={String(option.value)}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
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
                                "flex h-9 w-9 items-center justify-center rounded-[calc(var(--civo-radius)_-_2px)] border text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--civo-color-accent)]",
                                value === count
                                    ? "border-[var(--civo-color-accent)] bg-[var(--civo-color-accent)] text-white"
                                    : "border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] text-[var(--civo-color-text)] hover:border-[var(--civo-color-secondary)]"
                            )}
                        >
                            {count}
                        </button>
                    ))}
                </div>
            );
        case "switch":
            return (
                <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(value)}
                    onClick={() => {
                        onChange(!value);
                        onCommit();
                    }}
                    className={cn(
                        "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--civo-color-accent)]",
                        value ? "bg-[var(--civo-color-accent)]" : "bg-[var(--civo-color-border)]"
                    )}
                >
                    <span
                        className={cn(
                            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                            value ? "translate-x-4" : "translate-x-0.5"
                        )}
                    />
                </button>
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
