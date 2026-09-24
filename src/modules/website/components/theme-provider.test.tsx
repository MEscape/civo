import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@/modules/website/components/theme-provider";
import { defaultTheme } from "@/modules/website/domain/theme";

describe("ThemeProvider", () => {
    it("scopes the site's theme on one wrapper that page components can query and re-derive tokens against", () => {
        const { container } = render(
            <ThemeProvider theme={{ ...defaultTheme, colors: { primary: "#1a1a1a", secondary: "#333333", accent: "#00e5ff" } }}>
                <p>content</p>
            </ThemeProvider>,
        );
        const wrapper = container.firstElementChild as HTMLElement;

        // globals.css keys the per-site chart palette off this attribute.
        expect(wrapper).toHaveAttribute("data-civo-theme");
        // The wrapper is the container that @2xl:/@5xl: page breakpoints measure.
        expect(wrapper.className).toContain("@container");
        // The brand colors and their derived readable variants are set inline.
        expect(wrapper.style.getPropertyValue("--civo-color-accent")).toBe("#00e5ff");
        expect(wrapper.style.getPropertyValue("--civo-color-accent-foreground")).toBe("#000000");
        expect(wrapper.style.getPropertyValue("--civo-color-primary-foreground")).toBe("#ffffff");
    });

    it("renders its children", () => {
        const { getByText } = render(
            <ThemeProvider theme={defaultTheme}>
                <p>hello</p>
            </ThemeProvider>,
        );
        expect(getByText("hello")).toBeInTheDocument();
    });
});
