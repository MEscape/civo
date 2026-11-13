'use client';

import { DataSourceMappingTable } from './data-source-mapping-table';
import { MappingLoading, MappingProgress, ReloadFieldsButton } from './mapping-progress';

import type { useMappingWizard } from '../../hooks/use-mapping-wizard';

interface MappingFieldsStepProps {
  readonly screen: ReturnType<typeof useMappingWizard>;
}

/** The first step: what the source returned, and which of its fields feeds which target. */
export function MappingFieldsStep({ screen }: MappingFieldsStepProps) {
  const { fields, failure, isPending } = screen;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ReloadFieldsButton
          isVisible={fields !== null || failure !== null}
          isPending={isPending}
          onClick={screen.handleDiscover}
        />
      </div>
      {fields === null ? (
        <MappingLoading isPending={isPending} />
      ) : (
        <>
          <MappingProgress
            suggestedCount={screen.suggestedCount}
            missing={screen.missingRequired.map((target) => screen.targetLabel(target.path))}
            preservedAssignments={screen.preservedAssignments}
          />
          <DataSourceMappingTable
            fields={fields}
            assignments={screen.assignments}
            targets={screen.targets}
            targetLabel={screen.targetLabel}
            targetsUsedElsewhere={screen.targetsUsedElsewhere}
            onAssign={screen.handleAssign}
            isPending={isPending}
          />
        </>
      )}
    </div>
  );
}
