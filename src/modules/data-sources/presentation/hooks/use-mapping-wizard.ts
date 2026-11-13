'use client';

import { usePathname, useRouter } from '@i18n';

import { MAPPING_FORM_STEPS } from '../forms/mapping-form-steps';
import { dataSourceRoutes } from '../routes';

import { useDataSourceMapping } from './use-data-source-mapping';

import type { CanonicalKind, DatasetMappingView } from '../../application/contracts/dataset-views';
import type { MappingFormStep } from '../forms/mapping-form-steps';

interface MappingWizardOptions {
  readonly websiteId: string;
  readonly sourceId: string;
  readonly datasetId: string;
  readonly canonicalKind: CanonicalKind;
  readonly existingMapping: DatasetMappingView | null;
  readonly step: MappingFormStep;
}

/**
 * The mapping as a wizard like every other form: the fields are read and assigned on the first
 * step, the result is checked and saved on the last. Saving returns to the source, whose list then
 * shows the dataset as ready to use. The assignments are no react-hook-form form, so the step
 * address is kept here the way `useWizardSteps` keeps it, with completeness instead of field
 * validation as the gate to the next step.
 */
export function useMappingWizard({
  websiteId,
  sourceId,
  datasetId,
  canonicalKind,
  existingMapping,
  step,
}: MappingWizardOptions) {
  const router = useRouter();
  const pathname = usePathname();
  const mapping = useDataSourceMapping({
    datasetId,
    canonicalKind,
    existingMapping,
    autoLoad: true,
    onSaved: () => {
      router.replace(dataSourceRoutes.source(websiteId, sourceId));
    },
  });
  const { checkComplete, handlePreview } = mapping;
  const index = MAPPING_FORM_STEPS.indexOf(step);
  const previous = MAPPING_FORM_STEPS[index - 1];
  const next = MAPPING_FORM_STEPS[index + 1];
  const goTo = (target: MappingFormStep) => {
    router.push(`${pathname}?step=${target}`);
  };

  return {
    ...mapping,
    wizard: {
      previous,
      next,
      goBack: () => {
        if (previous !== undefined) {
          goTo(previous);
        }
      },
      /** On to review only when it is complete; the preview of the record is ready when it opens. */
      goNext: () => {
        if (checkComplete() && next !== undefined) {
          handlePreview();
          goTo(next);
        }
      },
    },
  };
}
