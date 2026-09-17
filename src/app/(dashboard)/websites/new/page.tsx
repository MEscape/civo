import { Container } from "@/components/layout/layout-primitives";
import { CreateWebsiteForm } from "@/modules/website/components/create-website-form";

export default function NewWebsitePage() {
    return (
        <Container className="max-w-2xl py-10">
            <h1 className="mb-8 font-[family-name:var(--civo-font-heading)] text-2xl text-[var(--civo-color-text)]">
                Neue Website erstellen
            </h1>
            <CreateWebsiteForm />
        </Container>
    );
}
