"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWebsiteAction } from "@/modules/website/application/website-actions";
import { listTemplates } from "@/modules/website/domain/templates";
import { createWebsiteSchema, type CreateWebsiteInput } from "@/modules/website/domain/website-schema";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const templates = listTemplates();

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function CreateWebsiteForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [slugEdited, setSlugEdited] = useState(false);

    const form = useForm<CreateWebsiteInput>({
        resolver: zodResolver(createWebsiteSchema),
        defaultValues: {
            name: "",
            slug: "",
            templateKey: "municipal",
        },
    });

    const currentName = useWatch({ control: form.control, name: "name" });
    const currentTemplateKey = useWatch({ control: form.control, name: "templateKey" });

    useEffect(() => {
        if (!slugEdited && currentName) {
            form.setValue("slug", slugify(currentName), { shouldValidate: true });
        }
    }, [currentName, slugEdited, form]);

    function onSubmit(data: CreateWebsiteInput) {
        setError(null);
        startTransition(async () => {
            const result = await createWebsiteAction(data);
            if (!result.ok) {
                setError(result.message);
                return;
            }
            router.push(`/websites/${result.data.id}/builder`);
        });
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    placeholder="Stadt Musterstadt"
                    {...form.register("name")}
                />
                {form.formState.errors.name && (
                    <p className="text-sm text-red-700">{form.formState.errors.name.message}</p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                    id="slug"
                    placeholder="musterstadt"
                    {...form.register("slug", {
                        onChange: (e) => {
                            setSlugEdited(true);
                            form.setValue("slug", slugify(e.target.value), { shouldValidate: true });
                        }
                    })}
                />
                {form.formState.errors.slug && (
                    <p className="text-sm text-red-700">{form.formState.errors.slug.message}</p>
                )}
            </div>

            <div className="space-y-1.5">
                <Label>Template</Label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {templates.map((template) => (
                        <button
                            key={template.key}
                            type="button"
                            onClick={() => form.setValue("templateKey", template.key, { shouldValidate: true })}
                            className={`text-left ${currentTemplateKey === template.key ? "ring-2 ring-[var(--civo-color-accent)]" : ""}`}
                        >
                            <Card>
                                <CardContent className="pt-4">
                                    <p className="text-sm font-medium text-[var(--civo-color-text)]">{template.label}</p>
                                    <p className="mt-1 text-xs text-[var(--civo-color-text-muted)]">
                                        {template.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </button>
                    ))}
                </div>
                {form.formState.errors.templateKey && (
                    <p className="text-sm text-red-700">{form.formState.errors.templateKey.message}</p>
                )}
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <Button type="submit" disabled={isPending}>
                {isPending ? "Wird erstellt…" : "Website erstellen"}
            </Button>
        </form>
    );
}
