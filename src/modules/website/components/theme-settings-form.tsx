"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateThemeAction } from "@/modules/website/application/website-actions";
import { Input, Label, Select } from "@/components/ui/input";
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
                <h2 className="mb-6 text-xl font-semibold text-copy">Theme Einstellungen</h2>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-token border border-border bg-surface p-6">
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-copy">Farben</h3>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <ColorField form={form} name="primaryColor" label="Primär" value={previewTheme.colors.primary} fallback={initialTheme.colors.primary} />
                            <ColorField form={form} name="secondaryColor" label="Sekundär" value={previewTheme.colors.secondary} fallback={initialTheme.colors.secondary} />
                            <ColorField form={form} name="accentColor" label="Akzent" value={previewTheme.colors.accent} fallback={initialTheme.colors.accent} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-copy">Typografie</h3>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="headingFont">Überschriften</Label>
                                <Select id="headingFont" {...form.register("headingFont")}>
                                    {AVAILABLE_HEADING_FONTS.map(font => (
                                        <option key={font} value={font}>{font}</option>
                                    ))}
                                </Select>
                                {form.formState.errors.headingFont && <p className="text-xs text-danger">{form.formState.errors.headingFont.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="bodyFont">Fließtext</Label>
                                <Select id="bodyFont" {...form.register("bodyFont")}>
                                    {AVAILABLE_BODY_FONTS.map(font => (
                                        <option key={font} value={font}>{font}</option>
                                    ))}
                                </Select>
                                {form.formState.errors.bodyFont && <p className="text-xs text-danger">{form.formState.errors.bodyFont.message}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-copy">Layout</h3>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="radius">Abrundung</Label>
                                <Select id="radius" {...form.register("radius")}>
                                    <option value="none">Eckig (0px)</option>
                                    <option value="sm">Leicht (2px)</option>
                                    <option value="md">Mittel (6px)</option>
                                    <option value="lg">Stark (12px)</option>
                                </Select>
                                {form.formState.errors.radius && <p className="text-xs text-danger">{form.formState.errors.radius.message}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="spacingScale">Abstände</Label>
                                <Select id="spacingScale" {...form.register("spacingScale")}>
                                    <option value="compact">Kompakt</option>
                                    <option value="comfortable">Komfortabel</option>
                                    <option value="spacious">Großzügig</option>
                                </Select>
                                {form.formState.errors.spacingScale && <p className="text-xs text-danger">{form.formState.errors.spacingScale.message}</p>}
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-sm text-danger">{error}</p>}
                    {success && <p className="text-sm text-success">Theme erfolgreich gespeichert!</p>}

                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Speichert…" : "Theme speichern"}
                    </Button>
                </form>
            </div>

            <div>
                <h2 className="mb-6 text-xl font-semibold text-copy">Live-Vorschau</h2>
                {/* Illustration only: hidden from assistive tech, so it holds no headings, links or buttons. */}
                <div aria-hidden="true" className="relative min-h-96 overflow-hidden rounded-token border border-border bg-canvas p-6">
                    <ThemeProvider theme={previewTheme}>
                        <div className="mx-auto max-w-sm space-y-section rounded-token border border-border bg-canvas p-4">
                            <div>
                                <p className="mb-2 font-heading text-3xl font-bold text-copy">
                                    Willkommen
                                </p>
                                <p className="font-body text-base text-copy-muted">
                                    Dies ist eine Vorschau, wie Ihre Komponenten mit den neuen Theme-Einstellungen aussehen werden.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <span className="rounded-token bg-primary px-4 py-2 font-body font-medium text-primary-foreground">
                                    Primär
                                </span>
                                <span className="rounded-token bg-secondary px-4 py-2 font-body font-medium text-secondary-foreground">
                                    Sekundär
                                </span>
                                <span className="rounded-token bg-accent px-4 py-2 font-body font-medium text-accent-foreground">
                                    Akzent
                                </span>
                            </div>

                            <div className="rounded-token border border-border bg-surface p-4">
                                <p className="mb-2 font-heading text-xl font-semibold text-copy">
                                    Karte
                                </p>
                                <p className="font-body text-sm text-copy-muted">
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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * One brand color: a native picker plus an editable hex field. The visible
 * label names the hex field (htmlFor/id), the picker gets its own accessible
 * name, and a validation message is tied to the field so assistive tech
 * reads it with the input. `value` may be half-typed; the native picker only
 * accepts a full #rrggbb, so it shows `fallback` until the text is valid.
 */
function ColorField({
    form,
    name,
    label,
    value,
    fallback,
}: {
    form: UseFormReturn<ThemeInput>;
    name: "primaryColor" | "secondaryColor" | "accentColor";
    label: string;
    value: string;
    fallback: string;
}) {
    const errorId = `${name}-error`;
    const error = form.formState.errors[name]?.message;

    return (
        <div className="space-y-1.5">
            <Label htmlFor={name}>{label}</Label>
            <div className="flex gap-2">
                <Input
                    type="color"
                    aria-label={`${label}: Farbe auswählen`}
                    className="h-9 w-12 cursor-pointer p-1"
                    value={HEX_COLOR.test(value) ? value : fallback}
                    onChange={(event) => form.setValue(name, event.target.value, { shouldValidate: true, shouldDirty: true })}
                />
                <Input
                    id={name}
                    className="flex-1"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    {...form.register(name)}
                />
            </div>
            {error && (
                <p id={errorId} className="text-xs text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
