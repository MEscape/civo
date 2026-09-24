import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import tsParser from "@typescript-eslint/parser";

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,

    {
        files: ["src/**/*.ts", "src/**/*.tsx"],

        languageOptions: {
            parser: tsParser,
        },

        plugins: {
            boundaries,
        },

        settings: {
            "boundaries/include": ["src/**/*.ts", "src/**/*.tsx"],

            "boundaries/elements": [
                { type: "domain", pattern: "src/modules/**/domain/**" },
                { type: "application", pattern: "src/modules/**/application/**" },
                { type: "infrastructure", pattern: "src/modules/**/infrastructure/**" },
                { type: "module-components", pattern: "src/modules/**/components/**" },
                { type: "global-components", pattern: "src/components/**" },
                { type: "lib", pattern: "src/lib/**" },
                { type: "app", pattern: "src/app/**" },
                { type: "store", pattern: "src/store/**" },
            ],
        },

        rules: {
            "boundaries/dependencies": [
                "error",
                {
                    default: "allow",

                    policies: [
                        {
                            from: { element: { type: "domain" } },
                            disallow: [
                                { element: { type: "application" } },
                                { element: { type: "infrastructure" } },
                                { element: { type: "module-components" } },
                                { element: { type: "global-components" } },
                                { element: { type: "app" } },
                                { element: { type: "store" } }
                            ],
                            message: "domain/** must stay framework-free. It may depend on other domain/** modules and lib/** only.",
                        },

                        {
                            from: { element: { type: "application" } },
                            disallow: [
                                { element: { type: "module-components" } },
                                { element: { type: "global-components" } },
                                { element: { type: "app" } }
                            ],
                            message: "application/** must not import UI components. It should coordinate domain and infrastructure.",
                        },

                        {
                            from: { element: { type: "store" } },
                            disallow: [
                                { element: { type: "module-components" } },
                                { element: { type: "global-components" } },
                                { element: { type: "app" } },
                                { element: { type: "infrastructure" } }
                            ],
                            message: "store/** must only depend on domain or application layers.",
                        },
                    ],
                },
            ],
        },
    },

    {
        files: ["src/modules/**/domain/**/*.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "@prisma/client",
                            message: "domain/** must not import @prisma/client directly.",
                        },
                        {
                            name: "react",
                            message: "domain/** must stay framework-free.",
                        },
                        {
                            name: "next/cache",
                            message: "domain/** must stay framework-free.",
                        },
                        {
                            name: "@reduxjs/toolkit",
                            message: "domain/** must stay framework-free.",
                        },
                        {
                            name: "react-redux",
                            message: "domain/** must stay framework-free.",
                        },
                    ],
                },
            ],
        },
    },

    {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
        },
    },

    // Override default ignores of eslint-config-next.
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
    ]),
]);

export default eslintConfig;
