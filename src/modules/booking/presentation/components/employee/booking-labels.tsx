import type { OpenBookingDto } from '../../dto/booking-dto';

export interface BookingLabelsProps {
  readonly labels: OpenBookingDto['labels'];
  /** What to call a service that is gone, already translated. */
  readonly unnamed: string;
  /** The heading level of the service name in its list. */
  readonly as?: 'h2' | 'h3';
}

/** What a booking is and where: the service, then the location and the rooms it holds. */
export function BookingLabels({ labels, unnamed, as: Heading = 'h3' }: BookingLabelsProps) {
  const place = [labels.locationName, ...labels.resourceNames].filter(Boolean).join(' · ');
  return (
    <div className="min-w-0">
      <Heading className="font-medium text-copy">{labels.serviceName ?? unnamed}</Heading>
      {place !== '' && <p className="text-sm text-copy-muted">{place}</p>}
    </div>
  );
}
