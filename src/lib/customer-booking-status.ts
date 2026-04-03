import type {
  Booking,
  BookingMethod,
  BookingPaymentStatusRecord,
  CustomerBookingStatus,
  SharedBookingStatus,
} from '@/types';

export function deriveCustomerBookingStatus(input: {
  method: BookingMethod;
  status: SharedBookingStatus;
  paymentStatus?: BookingPaymentStatusRecord['status'] | null;
}): CustomerBookingStatus {
  if (input.status === 'draft') return 'cancelled';
  if (input.paymentStatus === 'expired') return 'payment_expired';
  if (input.status === 'done') return 'completed';
  if (input.status === 'quote') return 'quote';
  if (input.status === 'ready') return 'in_progress';

  if (input.method === 'pickup') {
    if (input.paymentStatus !== 'paid') return 'awaiting_payment';
    return 'booking_confirmed';
  }

  if (input.status === 'new' || input.status === 'awaiting') {
    return 'booking_confirmed';
  }

  return 'booking_created';
}

export function withCustomerBookingStatus<T extends Booking>(booking: T): T {
  return {
    ...booking,
    customer_status: deriveCustomerBookingStatus({
      method: booking.method,
      status: booking.status,
      paymentStatus: booking.payment_status?.status ?? null,
    }),
  };
}

export function getCustomerBookingStatusLabel(status: CustomerBookingStatus): string {
  switch (status) {
    case 'booking_created':
      return 'Booking oprettet';
    case 'awaiting_payment':
      return 'Afventer betaling';
    case 'booking_confirmed':
      return 'Bekræftet';
    case 'in_progress':
      return 'I gang';
    case 'quote':
      return 'Afventer tilbud';
    case 'completed':
      return 'Færdig';
    case 'payment_expired':
      return 'Betaling udløbet';
    case 'cancelled':
      return 'Annulleret';
    default:
      return status;
  }
}

export function isBookingActive(status: CustomerBookingStatus): boolean {
  return ['booking_created', 'awaiting_payment', 'booking_confirmed', 'in_progress', 'quote'].includes(
    status
  );
}
