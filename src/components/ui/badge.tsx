import type { CustomerBookingStatus } from '@/types';

type BadgeVariant = 'gray' | 'blue' | 'amber' | 'green' | 'red';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gray: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
};

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.08em] uppercase',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

const statusConfig: Record<CustomerBookingStatus, { label: string; variant: BadgeVariant }> = {
  booking_created: { label: 'Booking oprettet', variant: 'blue' },
  awaiting_payment: { label: 'Afventer betaling', variant: 'amber' },
  booking_confirmed: { label: 'Bekræftet', variant: 'green' },
  in_progress: { label: 'I gang', variant: 'blue' },
  quote: { label: 'Afventer tilbud', variant: 'amber' },
  completed: { label: 'Færdig', variant: 'green' },
  payment_expired: { label: 'Betaling udløbet', variant: 'red' },
  cancelled: { label: 'Annulleret', variant: 'gray' },
};

export function BookingStatusBadge({ status }: { status: CustomerBookingStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
