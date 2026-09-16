import { describe, it, expect } from "vitest";
import { isSafeLink, safeLinkOrUndefined } from "@/lib/utils/safe-link";

describe("isSafeLink", () => {
    // Safe relative paths
    it("allows absolute relative paths", () => {
        expect(isSafeLink("/leistungen/ausweis")).toBe(true);
    });
    it("allows ./-relative paths", () => {
        expect(isSafeLink("./about")).toBe(true);
    });
    it("allows ../-relative paths", () => {
        expect(isSafeLink("../parent")).toBe(true);
    });

    // Safe absolute URLs
    it("allows https URLs", () => {
        expect(isSafeLink("https://www.musterstadt.de")).toBe(true);
    });
    it("allows http URLs", () => {
        expect(isSafeLink("http://internal.musterstadt.de")).toBe(true);
    });
    it("allows mailto: links", () => {
        expect(isSafeLink("mailto:buergerbuero@musterstadt.de")).toBe(true);
    });
    it("allows tel: links", () => {
        expect(isSafeLink("tel:+4975410001")).toBe(true);
    });

    // Unsafe schemes
    it("rejects javascript: scheme", () => {
        expect(isSafeLink("javascript:alert(1)")).toBe(false);
    });
    it("rejects javascript: scheme with leading whitespace", () => {
        expect(isSafeLink("  javascript:alert(1)")).toBe(false);
    });
    it("rejects data: scheme", () => {
        expect(isSafeLink("data:text/html,<script>alert(1)</script>")).toBe(false);
    });
    it("rejects vbscript: scheme", () => {
        expect(isSafeLink("vbscript:MsgBox(1)")).toBe(false);
    });

    // Edge cases
    it("rejects empty string", () => {
        expect(isSafeLink("")).toBe(false);
    });
    it("rejects whitespace-only string", () => {
        expect(isSafeLink("   ")).toBe(false);
    });
    it("rejects null", () => {
        expect(isSafeLink(null)).toBe(false);
    });
    it("rejects undefined", () => {
        expect(isSafeLink(undefined)).toBe(false);
    });
    it("rejects number", () => {
        expect(isSafeLink(42)).toBe(false);
    });
    it("rejects malformed URL that isn't a known scheme", () => {
        expect(isSafeLink("ftp://files.musterstadt.de")).toBe(false);
    });
});

describe("safeLinkOrUndefined", () => {
    it("returns the trimmed href for a safe link", () => {
        expect(safeLinkOrUndefined("  /kontakt  ")).toBe("/kontakt");
    });
    it("returns undefined for an unsafe link", () => {
        expect(safeLinkOrUndefined("javascript:void(0)")).toBeUndefined();
    });
});
