"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils/cn";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            className={cn(
                "inline-flex items-center gap-1 border-b border-[var(--civo-color-border)]",
                className
            )}
            {...props}
        />
    );
}

export function TabsTrigger({
                                className,
                                ...props
                            }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            className={cn(
                "px-4 py-2 text-sm font-medium text-[var(--civo-color-text-muted)] border-b-2 border-transparent -mb-px data-[state=active]:text-[var(--civo-color-primary)] data-[state=active]:border-[var(--civo-color-primary)]",
                className
            )}
            {...props}
        />
    );
}

export function TabsContent({
                                className,
                                ...props
                            }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            className={cn("pt-6 text-sm text-[var(--civo-color-text)]", className)}
            {...props}
        />
    );
}
