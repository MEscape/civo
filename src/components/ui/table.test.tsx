import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

function Sample({ label }: { label: string }) {
    return (
        <Table label={label}>
            <TableHeader>
                <TableRow>
                    <TableHead>Kennzahl</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRow>
                    <TableCell>Radverkehrsanteil</TableCell>
                </TableRow>
            </TableBody>
        </Table>
    );
}

describe("Table", () => {
    it("scrolls inside a named region, so the page itself never scrolls sideways", () => {
        render(<Sample label="Stadt in Zahlen" />);
        const region = screen.getByRole("region", { name: "Stadt in Zahlen" });
        expect(region.className).toContain("overflow-x-auto");
        expect(region).toContainElement(screen.getByRole("table"));
    });

    it("makes the scroll region keyboard-focusable: without it, keyboard-only users cannot reach columns hidden by horizontal scrolling (WCAG 2.1.1)", () => {
        render(<Sample label="Stadt in Zahlen" />);
        expect(screen.getByRole("region", { name: "Stadt in Zahlen" })).toHaveAttribute("tabindex", "0");
    });

    it("renders normal table semantics inside", () => {
        render(<Sample label="x" />);
        expect(screen.getByRole("columnheader", { name: "Kennzahl" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "Radverkehrsanteil" })).toBeInTheDocument();
    });
});
