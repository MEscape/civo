import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
    beforeEach(() => {
        vi.spyOn(console, "info").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("logs an info message", () => {
        logger.info("Application started");

        expect(console.info).toHaveBeenCalledTimes(1);

        const serialized = vi.mocked(console.info).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry).toMatchObject({
            level: "info",
            message: "Application started",
        });

        expect(entry.timestamp).toEqual(expect.any(String));
        expect(new Date(entry.timestamp).toString()).not.toBe("Invalid Date");
    });

    it("logs a warn message", () => {
        logger.warn("Something looks suspicious");

        expect(console.warn).toHaveBeenCalledTimes(1);

        const serialized = vi.mocked(console.warn).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry).toMatchObject({
            level: "warn",
            message: "Something looks suspicious",
        });

        expect(entry.timestamp).toEqual(expect.any(String));
    });

    it("logs an error message", () => {
        logger.error("Something went wrong");

        expect(console.error).toHaveBeenCalledTimes(1);

        const serialized = vi.mocked(console.error).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry).toMatchObject({
            level: "error",
            message: "Something went wrong",
        });

        expect(entry.timestamp).toEqual(expect.any(String));
    });

    it("includes payload when provided", () => {
        logger.info("User created", {
            userId: "user-123",
            source: "signup",
        });

        const serialized = vi.mocked(console.info).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry).toMatchObject({
            level: "info",
            message: "User created",
            payload: {
                userId: "user-123",
                source: "signup",
            },
        });
    });

    it("supports an empty payload object", () => {
        logger.info("Request completed", {});

        const serialized = vi.mocked(console.info).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry).toHaveProperty("payload");
        expect(entry.payload).toEqual({});
    });

    it("does not include payload when it is omitted", () => {
        logger.info("Request completed");

        const serialized = vi.mocked(console.info).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry).not.toHaveProperty("payload");
    });

    it("preserves different payload value types", () => {
        logger.info("Structured event", {
            stringValue: "hello",
            numberValue: 42,
            booleanValue: true,
            nullValue: null,
            arrayValue: [1, 2, 3],
            objectValue: {
                nested: "value",
            },
        });

        const serialized = vi.mocked(console.info).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry.payload).toEqual({
            stringValue: "hello",
            numberValue: 42,
            booleanValue: true,
            nullValue: null,
            arrayValue: [1, 2, 3],
            objectValue: {
                nested: "value",
            },
        });
    });

    it("writes info messages using console.info", () => {
        logger.info("info message");

        expect(console.info).toHaveBeenCalledTimes(1);
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("writes warn messages using console.warn", () => {
        logger.warn("warn message");

        expect(console.info).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("writes error messages using console.error", () => {
        logger.error("error message");

        expect(console.info).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("serializes entries as valid JSON", () => {
        logger.info("JSON test", {
            requestId: "req-123",
        });

        const serialized = vi.mocked(console.info).mock.calls[0][0];

        expect(() => JSON.parse(serialized as string)).not.toThrow();
    });

    it("creates an ISO timestamp", () => {
        logger.info("Timestamp test");

        const serialized = vi.mocked(console.info).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry.timestamp).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
        );
    });

    it("logs messages containing special characters correctly", () => {
        logger.info('Message with "quotes", newline\nand unicode: ✓');

        const serialized = vi.mocked(console.info).mock.calls[0][0];
        const entry = JSON.parse(serialized as string);

        expect(entry.message).toBe(
            'Message with "quotes", newline\nand unicode: ✓',
        );
    });

    it("writes exactly one JSON object per log call", () => {
        logger.info("First message");
        logger.info("Second message");

        expect(console.info).toHaveBeenCalledTimes(2);

        for (const [serialized] of vi.mocked(console.info).mock.calls) {
            expect(typeof serialized).toBe("string");

            const entry = JSON.parse(serialized as string);

            expect(entry).toHaveProperty("level", "info");
            expect(entry).toHaveProperty("message");
            expect(entry).toHaveProperty("timestamp");
        }
    });
});
