import type { ReactNode } from 'react';

import { ConfirmationPanel } from './confirmation-panel';
import { DetailsStep } from './details-step';
import { LocationStep } from './location-step';
import { ParticipantsStep } from './participants-step';
import { ReviewStep } from './review-step';
import { ServiceStep } from './service-step';
import { TimeStep } from './time-step.client';

import type { FlowStep } from '../../flow/flow-state';
import type { BookingFlowController } from '../../hooks/use-booking-flow';

export interface FlowStepViewProps {
  readonly websiteId: string;
  readonly flow: BookingFlowController;
  readonly readOnly: boolean;
  readonly onManage: () => void;
}

/** A step shows only once what it depends on is there; until then it renders nothing. */
type StepRenderer = (props: FlowStepViewProps) => ReactNode;

const renderService: StepRenderer = ({ flow }) => (
  <ServiceStep
    services={flow.config.services}
    onSelect={(serviceId) => {
      flow.dispatch({ type: 'select-service', serviceId });
    }}
  />
);

const renderLocation: StepRenderer = ({ flow }) =>
  flow.service === null ? null : (
    <LocationStep
      locations={flow.service.locations}
      selectedId={flow.state.locationId}
      onSelect={(locationId) => {
        flow.dispatch({ type: 'select-location', locationId });
      }}
    />
  );

const renderParticipants: StepRenderer = ({ flow }) =>
  flow.service === null ? null : (
    <ParticipantsStep
      initial={flow.state.participants}
      max={flow.service.maxParticipantsPerBooking}
      onSubmit={(participants) => {
        flow.dispatch({ type: 'set-participants', participants });
        flow.dispatch({ type: 'go-to', step: 'time' });
      }}
    />
  );

const renderTime: StepRenderer = ({ websiteId, flow, readOnly }) =>
  flow.service === null || flow.state.locationId === null ? null : (
    <TimeStep
      websiteId={websiteId}
      service={flow.service}
      locationId={flow.state.locationId}
      participants={flow.state.participants}
      slot={flow.state.slot}
      timeZone={flow.state.timeZone}
      readOnly={readOnly}
      onChoose={flow.chooseSlot}
      onTaken={() => {
        flow.dispatch({ type: 'hold-lost' });
      }}
      onHeld={flow.acquireHold}
    />
  );

const renderDetails: StepRenderer = ({ flow }) =>
  flow.service === null || flow.state.hold === null ? null : (
    <DetailsStep
      service={flow.service}
      values={flow.state.values}
      serverErrors={flow.serverErrors}
      onChange={flow.changeValue}
      onBack={flow.backFromDetails}
      onSubmit={flow.submitDetails}
    />
  );

const renderReview: StepRenderer = ({ flow, readOnly }) =>
  flow.service === null || flow.state.hold === null ? null : (
    <ReviewStep
      service={flow.service}
      hold={flow.state.hold}
      values={flow.state.values}
      locationAddress={flow.locationAddress}
      isPending={flow.isPending}
      readOnly={readOnly}
      onBack={() => {
        flow.dispatch({ type: 'go-to', step: 'details' });
      }}
      onConfirm={flow.confirm}
    />
  );

const renderDone: StepRenderer = ({ flow, onManage }) =>
  flow.state.booking === null ? null : (
    <ConfirmationPanel
      booking={flow.state.booking}
      showParticipants={(flow.service?.maxParticipantsPerBooking ?? 1) > 1}
      onManage={onManage}
      onBookAnother={() => {
        flow.dispatch({ type: 'restart' });
      }}
    />
  );

/** Typed over every step: a step added to the flow without a screen does not compile. */
const RENDERERS = {
  service: renderService,
  location: renderLocation,
  participants: renderParticipants,
  time: renderTime,
  details: renderDetails,
  review: renderReview,
  done: renderDone,
} as const satisfies Record<FlowStep, StepRenderer>;

/** The screen of the current step. */
export function FlowStepView(props: FlowStepViewProps) {
  return RENDERERS[props.flow.state.step](props);
}
