import React from "react";
import { IconMap } from "@/components/ui/icons";

const DEFAULT_FALLBACK = "circle-help";

type AppDynamicIconProps = React.SVGProps<SVGSVGElement> & {
    name?: string;
    fallback?: string;
};

export function DynamicIcon({ name, fallback = DEFAULT_FALLBACK, ...props }: AppDynamicIconProps) {
    const key = toKebabCase(name);
    const iconName = key ?? fallback;

    const IconComponent = IconMap[iconName] || IconMap[fallback] || IconMap[DEFAULT_FALLBACK];

    return <IconComponent {...props} />;
}

function toKebabCase(name?: string): string | null {
    if (!name?.trim()) return null;
    return name
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
}
