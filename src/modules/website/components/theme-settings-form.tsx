"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateThemeAction } from "@/modules/website/application/website-actions";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeProvider } from "@/modules/website/components/theme-provider";
import { AVAILABLE_BODY_FONTS, AVAILABLE_HEADING_FONTS, type WebsiteTheme, type ThemeRadius, type ThemeSpacingScale } from "@/modules/website/domain/theme";
import { themeInputSchema, type ThemeInput } from "@/modules/website/domain/website-schema";

type ThemeSettingsFormProps = {
    websiteId: string;
    themeId: string;
    initialTheme: WebsiteTheme;
};

export function ThemeSettingsForm({ websiteId, themeId, initialTheme }: ThemeSettingsFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const form = useForm<ThemeInput>({
        resolver: zodResolver(themeInputSchema),
        defaultValues: {
            primaryColor: initialTheme.colors.primary,
            secondaryColor: initialTheme.colors.secondary,
            accentColor: initialTheme.colors.accent,
            headingFont: initialTheme.typography.headingFont,
            bodyFont: initialTheme.typography.bodyFont,
            radius: initialTheme.radius,
            spacingScale: initialTheme.spacingScale,
        }
    });

    // Watch values for live preview
    const formValues = useWatch({ control: form.control });

    const previewTheme: WebsiteTheme = {
        colors: {
            primary: formValues.primaryColor ?? initialTheme.colors.primary,
            secondary: formValues.secondaryColor ?? initialTheme.colors.secondary,
            accent: formValues.accentColor ?? initialTheme.colors.accent
        },
        typography: {
            headingFont: formValues.headingFont ?? initialTheme.typography.headingFont,
            bodyFont: formValues.bodyFont ?? initialTheme.typography.bodyFont
        },
        radius: (formValues.radius as ThemeRadius) ?? initialTheme.radius,
        spacingScale: (formValues.spacingScale as ThemeSpacingScale) ?? initialTheme.spacingScale,
    };

    function onSubmit(data: ThemeInput) {
        setError(null);
        setSuccess(false);

        startTransition(async () => {
            const result = await updateThemeAction(themeId, data, websiteId);

            if (!result.ok) {
                setError(result.message);
                return;
            }

            setSuccess(true);
            router.refresh();
        });
    }

    return (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
                <h2 className="mb-6 text-xl font-semibold text-[var(--civo-color-text)]">Theme Einstellungen</h2>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-[var(--civo-radius)] border border-[var(--civo-color-border)] bg-[var(--civo-color-surface)] p-6">
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-[var(--civo-color-text)]">Farben</h3>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="primaryColor">Primär</Label>
                                <div className="flex gap-2">
                                    <Input id="primaryColor-color" type="color" className="w-12 p-1 h-9 cursor-pointer" {...form.register("primaryColor")} />
                                    <Input {...form.register("primaryColor")} className="flex-1" />
                                </div>
                                {form.formState.errors.primaryColor && <p className="text-xs text-red-700">{form.formState.errors.primaryColor.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="secondaryColor">Sekundär</Label>
                                <div className="flex gap-2">
                                    <Input id="secondaryColor-color" type="color" className="w-12 p-1 h-9 cursor-pointer" {...form.register("secondaryColor")} />
                                    <Input {...form.register("secondaryColor")} className="flex-1" />
                                </div>
                                {form.formState.errors.secondaryColor && <p className="text-xs text-red-700">{form.formState.errors.secondaryColor.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="accentColor">Akzent</Label>
                                <div className="flex gap-2">
                                    <Input id="accentColor-color" type="color" className="w-12 p-1 h-9 cursor-pointer" {...form.register("accentColor")} />
                                    <Input {...form.register("accentColor")} className="flex-1" />
                                </div>
                                {form.formState.errors.accentColor && <p className="text-xs text-red-700">{form.formState.errors.accentColor.message}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-[var(--civo-color-text)]">Typografie</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="headingFont">Überschriften</Label>
                                <select
                                    id="headingFont"
                                    {...form.register("headingFont")}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {AVAILABLE_HEADING_FONTS.map(font => (
                                        <option key={font} value={font}>{font}</option>
                                    ))}
                                </select>
                                {form.formState.errors.headingFont && <p className="text-xs text-red-700">{form.formState.errors.headingFont.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="bodyFont">Fließtext</Label>
                                <select
                                    id="bodyFont"
                                    {...form.register("bodyFont")}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {AVAILABLE_BODY_FONTS.map(font => (
                                        <option key={font} value={font}>{font}</option>
                                    ))}
                                </select>
                                {form.formState.errors.bodyFont && <p className="text-xs text-red-700">{form.formState.errors.bodyFont.message}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-[var(--civo-color-text)]">Layout</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="radius">Abrundung</Label>
                                <select
                                    id="radius"
                                    {...form.register("radius")}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="none">Eckig (0px)</option>
                                    <option value="sm">Leicht (2px)</option>
                                    <option value="md">Mittel (6px)</option>
                                    <option value="lg">Stark (12px)</option>
                                </select>
                                {form.formState.errors.radius && <p className="text-xs text-red-700">{form.formState.errors.radius.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="spacingScale">Abstände</Label>
                                <select
                                    id="spacingScale"
                                    {...form.register("spacingScale")}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="compact">Kompakt</option>
                                    <option value="comfortable">Komfortabel</option>
                                    <option value="spacious">Großzügig</option>
                                </select>
                                {form.formState.errors.spacingScale && <p className="text-xs text-red-700">{form.formState.errors.spacingScale.message}</p>}
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-700">{error}</p>}
                    {success && <p className="text-sm text-green-700">Theme erfolgreich gespeichert!</p>}

                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Speichert…" : "Theme speichern"}
                    </Button>
                </form>
            </div>

            <div>
                <h2 className="mb-6 text-xl font-semibold text-[var(--civo-color-text)]">Live-Vorschau</h2>
                <div className="rounded-xl border border-[var(--civo-color-border)] bg-gray-50 p-6 overflow-hidden relative min-h-[400px]">
                    <ThemeProvider theme={previewTheme}>
                        <div className="space-y-[var(--civo-section-spacing)] max-w-sm mx-auto p-4 bg-[var(--civo-color-background)] rounded-[var(--civo-radius)] shadow-sm border border-[var(--civo-color-border)]">
                            <div>
                                <h1 className="font-heading text-3xl font-bold text-[var(--civo-color-text)] mb-2">
                                    Willkommen
                                </h1>
                                <p className="font-body text-base text-[var(--civo-color-text-muted)]">
                                    Dies ist eine Vorschau, wie Ihre Komponenten mit den neuen Theme-Einstellungen aussehen werden.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button className="bg-[var(--civo-color-primary)] text-[var(--civo-color-primary-foreground)] px-4 py-2 font-body font-medium rounded-[var(--civo-radius)] hover:opacity-90">
                                    Primär
                                </button>
                                <button className="bg-[var(--civo-color-secondary)] text-[var(--civo-color-secondary-foreground)] px-4 py-2 font-body font-medium rounded-[var(--civo-radius)] hover:opacity-90">
                                    Sekundär
                                </button>
                                <button className="bg-[var(--civo-color-accent)] text-[var(--civo-color-accent-foreground)] px-4 py-2 font-body font-medium rounded-[var(--civo-radius)] hover:opacity-90">
                                    Akzent
                                </button>
                            </div>

                            <div className="bg-[var(--civo-color-surface)] border border-[var(--civo-color-border)] p-4 rounded-[var(--civo-radius)]">
                                <h3 className="font-heading text-xl font-semibold text-[var(--civo-color-text)] mb-2">
                                    Karte
                                </h3>
                                <p className="font-body text-sm text-[var(--civo-color-text-muted)]">
                                    Komponenten wie Karten übernehmen automatisch die abgerundeten Ecken und Hintergrundfarben des Themes.
                                </p>
                            </div>
                        </div>
                    </ThemeProvider>
                </div>
            </div>
        </div>
    );
}
