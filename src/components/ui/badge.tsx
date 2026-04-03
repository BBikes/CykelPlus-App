import type { BookingStatus } from '@/types';

type BadgeVariant = 'gray' | 'blue' | 'amber' | 'green' | 'red';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
};

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
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

const statusConfig: Record<BookingStatus, { label: string; variant: BadgeVariant }> = {
  booking_created: { label: 'Booking oprettet', variant: 'blue' },
  awaiting_payment: { label: 'Afventer betaling', variant: 'amber' },
  booking_confirmed: { label: 'Bekræftet', variant: 'green' },
  payment_expired: { label: 'Betaling udløbet', variant: 'red' },
  cancelled: { label: 'Annulleret', variant: 'gray' },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
