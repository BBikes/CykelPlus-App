import type { BikedeskTicket, SharedBookingStatus } from '@/types';

export const BIKEDESK_STATUSES = ['new', 'ready', 'done', 'awaiting', 'quote', 'draft'] as const;

export function isSharedBookingStatus(value: unknown): value is SharedBookingStatus {
  return typeof value === 'string' && BIKEDESK_STATUSES.includes(value as SharedBookingStatus);
}

export function normalizeSharedBookingStatus(value: unknown): SharedBookingStatus {
  if (isSharedBookingStatus(value)) {
    return value;
  }

  return 'awaiting';
}

export function getBikedeskTicketDisplayNumber(
  ticket: Pick<BikedeskTicket, 'id' | 'cardno' | 'autoincrementno'> | null | undefined
): string | null {
  if (!ticket) return null;

  const cardNumber = ticket.cardno?.trim();
  if (cardNumber) return cardNumber;

  if (typeof ticket.autoincrementno === 'number') {
    return ticket.autoincrementno.toString();
  }

  if (typeof ticket.id === 'number') {
    return ticket.id.toString();
  }

  return null;
}
