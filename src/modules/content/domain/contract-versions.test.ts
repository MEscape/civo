import { describe, it, expect } from "vitest";
import {
    currentContractVersions,
    contractVersionHistory,
    getCurrentContractVersion,
    isContractVersionSupported,
    type ContractName,
} from "@/modules/content/domain/contract-versions";

const allContracts = Object.keys(currentContractVersions) as ContractName[];

describe("contract-versions", () => {
    it("every contract starts at version 1, since none has had a breaking change yet", () => {
        for (const contract of allContracts) {
            expect(getCurrentContractVersion(contract)).toBe(1);
        }
    });

    it("every contract's current version is present in its own history", () => {
        for (const contract of allContracts) {
            expect(contractVersionHistory[contract]).toContain(currentContractVersions[contract]);
        }
    });

    it("isContractVersionSupported is true for every contract's current version", () => {
        for (const contract of allContracts) {
            expect(isContractVersionSupported(contract, currentContractVersions[contract])).toBe(true);
        }
    });

    it("isContractVersionSupported is false for a version that has never existed", () => {
        expect(isContractVersionSupported("CivicEvent", 99)).toBe(false);
        expect(isContractVersionSupported("CivicEvent", 0)).toBe(false);
    });
});
