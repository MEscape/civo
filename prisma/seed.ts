import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTemplate } from "../src/modules/website/domain/templates";
import { pageConfigSchema } from "../src/modules/builder/domain/page-schema";
import { MOCK_DATASETS } from "../src/data/musterstadt";
import "../src/modules/component-platform/infrastructure/definitions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Seeds one demo website per template, using the same
 * `template.generateHomePageConfig()` path a real "Create Website" action
 * would use — this keeps the seed script from drifting out of sync with
 * the actual creation flow, and re-validates the generated config with
 * Zod before persisting it (spec §21, §41).
 */
async function seedWebsite(options: {
    name: string;
    slug: string;
    description: string;
    templateKey: "municipal" | "smart-city" | "association";
    theme?: Partial<Prisma.ThemeCreateInput>;
}) {
    const existing = await prisma.website.findUnique({ where: { slug: options.slug } });
    if (existing) {
        console.log(`  Skipping "${options.name}" — slug "${options.slug}" already exists.`);
        return;
    }

    const template = getTemplate(options.templateKey);
    if (!template) throw new Error(`Unknown template: ${options.templateKey}`);

    const homeConfig = template.generateHomePageConfig();
    const parsed = pageConfigSchema.parse(homeConfig); // throws on invalid — a seed bug should fail loudly

    const website = await prisma.website.create({
        data: {
            name: options.name,
            slug: options.slug,
            description: options.description,
            templateKey: options.templateKey,
            theme: { create: options.theme || {} }, // platform defaults if none provided
            pages: {
                create: {
                    path: "",
                    title: "Startseite",
                    configs: {
                        create: {
                            content: parsed as Prisma.InputJsonValue,
                            status: "PUBLISHED",
                        },
                    },
                },
            },
        },
    });

    for (const ds of MOCK_DATASETS) {
        try {
            await prisma.dataSource.create({
                data: {
                    websiteId: website.id,
                    name: `Musterstadt API - ${ds.name}`,
                    kind: "MOCK",
                    config: { path: ds.path || "/" } as Prisma.InputJsonValue,
                    datasets: {
                        create: {
                            slug: ds.slug,
                            name: ds.name,
                            canonicalType: ds.canonicalType,
                            mapping: ds.mapping as Prisma.InputJsonValue,
                        },
                    },
                },
            });
        } catch (e) {
            console.error(`Failed to create DataSource for dataset ${ds.name}:`, e);
            throw e;
        }
    }

    console.log(`  Created "${website.name}" (${website.slug}).`);
}

async function main() {
    console.log("Seeding Civo demo data...");

    await seedWebsite({
        name: "Stadt Musterstadt",
        slug: "musterstadt",
        description: "Municipal homepage demo for the fictional city of Musterstadt.",
        templateKey: "municipal",
        theme: {
            primaryColor: "#024B6D", // Blue
            secondaryColor: "#577A8C",
            accentColor: "#D14900", // Orange accent
        },
    });

    await seedWebsite({
        name: "Musterstadt Smart City",
        slug: "musterstadt-smart-city",
        description: "Smart-city portal demo with KPI tiles and metrics.",
        templateKey: "smart-city",
        theme: {
            primaryColor: "#1A1A1A", // Dark theme
            secondaryColor: "#333333",
            accentColor: "#00E5FF", // Neon cyan
            radius: "none",
            spacingScale: "compact",
        },
    });

    await seedWebsite({
        name: "Turnverein Musterstadt e.V.",
        slug: "turnverein-musterstadt",
        description: "Association (Verein) website demo.",
        templateKey: "association",
        theme: {
            primaryColor: "#B51A1A", // Red
            secondaryColor: "#8C4A4A",
            accentColor: "#F2A900", // Yellow
            radius: "lg",
        },
    });

    await seedWebsite({
        name: "Landkreis Musterland",
        slug: "landkreis-musterland",
        description: "A secondary municipal demo for a regional county.",
        templateKey: "municipal",
        theme: {
            primaryColor: "#2E572D", // Green
            secondaryColor: "#4B754A",
            accentColor: "#F39C12", // Amber
            radius: "sm",
            spacingScale: "spacious",
        },
    });

    console.log("Done.");
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
