import { WorkspaceServices } from '@modules/booking/presentation/components/setup/workspace-services.client';
import type {
  BookingOptionsDto,
  LocationDto,
  ResourceDto,
  ServiceDto,
} from '@modules/booking/presentation/dto/setup-dto';

import { locationDto } from './fixtures';

export interface ServicesAtLocationProps {
  readonly services: readonly ServiceDto[];
  readonly options: BookingOptionsDto;
  readonly canConfigure: boolean;
  readonly location?: LocationDto;
  readonly resources?: readonly ResourceDto[];
  readonly otherServices?: readonly ServiceDto[];
}

/** The services section of a location's workspace, as the tests draw it: every service ready unless said otherwise. */
export function ServicesAtLocation({
  services,
  options,
  canConfigure,
  location = locationDto(),
  resources = [],
  otherServices = [],
}: ServicesAtLocationProps) {
  return (
    <WorkspaceServices
      location={location}
      entries={services.map((service) => ({ service, readiness: 'ready' as const }))}
      resources={resources}
      otherServices={otherServices}
      options={options}
      canConfigure={canConfigure}
      conflictIds={new Set()}
    />
  );
}
