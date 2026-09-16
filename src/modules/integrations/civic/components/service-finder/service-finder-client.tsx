"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ServiceDetail } from "@/modules/content/domain/content-types";

const FALLBACK_ICON = "ArrowRight" as const;

function resolveIcon(name?: string) {
    if (!name) return Icons[FALLBACK_ICON];
    const pascal = name
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[pascal];
    return Icon ?? Icons[FALLBACK_ICON];
}

export function ServiceFinderClient({
                                        services,
                                        placeholder,
                                        initialCategory,
                                    }: {
    services: ServiceDetail[];
    placeholder: string;
    initialCategory?: string;
}) {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState(initialCategory ?? "");

    const categories = Array.from(new Set(services.map((s) => s.category).filter((c): c is string => Boolean(c))));

    const filtered = (() => {
        const q = query.trim().toLowerCase();
        return services.filter((service) => {
            const matchesCategory = category ? service.category === category : true;
            const matchesQuery = q
                ? service.title.toLowerCase().includes(q) ||
                service.description?.toLowerCase().includes(q) ||
                service.keywords?.some((k) => k.toLowerCase().includes(q))
                : true;
            return matchesCategory && matchesQuery;
        });
    })();

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--civo-color-text-muted)]"
                        aria-hidden="true"
                    />
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={placeholder}
                        className="pl-9"
                        aria-label={placeholder}
                    />
                </div>
                {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setCategory("")}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                category === ""
                                    ? "bg-[var(--civo-color-primary)] text-white"
                                    : "bg-[var(--civo-color-surface)] text-[var(--civo-color-text-muted)] hover:text-[var(--civo-color-text)]"
                            }`}
                        >
                            Alle
                        </button>
                        {categories.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCategory(c)}
                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                    category === c
                                        ? "bg-[var(--civo-color-primary)] text-white"
                                        : "bg-[var(--civo-color-surface)] text-[var(--civo-color-text-muted)] hover:text-[var(--civo-color-text)]"
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {filtered.length === 0 ? (
                <p className="text-sm text-[var(--civo-color-text-muted)]">Keine passenden Leistungen gefunden.</p>
            ) : (
                <ul className="flex flex-col divide-y divide-[var(--civo-color-border)]">
                    {filtered.map((service) => {
                        const Icon = resolveIcon(service.icon);
                        return (
                            <li key={service.id}>
                                <a
                                    href={service.href}
                                    className="group flex items-start gap-4 py-4 hover:bg-[var(--civo-color-surface)]"
                                >
                                    <Card className="flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-[var(--civo-color-surface)]">
                                        <Icon className="h-5 w-5 text-[var(--civo-color-primary)]" aria-hidden="true" />
                                    </Card>
                                    <CardContent className="flex-1 p-0">
                                        <p className="text-sm font-medium text-[var(--civo-color-text)] group-hover:text-[var(--civo-color-primary)]">
                                            {service.title}
                                        </p>
                                        {service.description && (
                                            <p className="mt-0.5 text-sm text-[var(--civo-color-text-muted)]">
                                                {service.description}
                                            </p>
                                        )}
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            {service.department && <Badge variant="muted">{service.department}</Badge>}
                                            {service.processingNote && <Badge>{service.processingNote}</Badge>}
                                        </div>
                                    </CardContent>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
