"use client";

import { Provider } from "react-redux";
import { store } from "@/store/store";
import React from "react";

/**
 * Client Component boundary for the Redux Provider. Only the builder
 * route tree is wrapped in this — the public website render path never
 * imports Redux at all
 */
export function BuilderStoreProvider({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
}
