import { describe, expect, it } from "vitest";
import { resolveDataset } from "./data-source-resolver";



describe("resolveDataset", () => {
    it("returns null if no datasetId", async () => {
        expect(await resolveDataset(undefined)).toBeNull();
    });
});
