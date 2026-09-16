import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, unwrapOr, mapResult, mapError, combineResults } from "./result";

describe("Result utilities", () => {
    it("ok() creates a success result", () => {
        const result = ok(42);
        expect(result).toEqual({ ok: true, data: 42 });
    });

    it("err() creates a failure result", () => {
        const result = err("boom");
        expect(result).toEqual({ ok: false, error: "boom" });
    });

    it("isOk narrows to success", () => {
        const result = ok(1);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
            expect(result.data).toBe(1);
        }
    });

    it("isErr narrows to failure", () => {
        const result = err("nope");
        expect(isErr(result)).toBe(true);
    });

    it("unwrapOr returns data on success", () => {
        expect(unwrapOr(ok(5), 0)).toBe(5);
    });

    it("unwrapOr returns fallback on failure", () => {
        expect(unwrapOr(err("bad"), 0)).toBe(0);
    });

    it("mapResult transforms success value", () => {
        const result = mapResult(ok(2), (n) => n * 10);
        expect(result).toEqual({ ok: true, data: 20 });
    });

    it("mapResult leaves failure untouched", () => {
        const original = err("failed");
        const result = mapResult(original, (n: number) => n * 10);
        expect(result).toBe(original);
    });

    it("mapError transforms error value", () => {
        const result = mapError(err("bad"), (e) => `wrapped: ${e}`);
        expect(result).toEqual({ ok: false, error: "wrapped: bad" });
    });

    it("combineResults returns all data when every result succeeds", () => {
        const result = combineResults([ok(1), ok(2), ok(3)]);
        expect(result).toEqual({ ok: true, data: [1, 2, 3] });
    });

    it("combineResults returns the first error encountered", () => {
        const result = combineResults([ok(1), err("bad"), ok(3)]);
        expect(result).toEqual({ ok: false, error: "bad" });
    });
});
