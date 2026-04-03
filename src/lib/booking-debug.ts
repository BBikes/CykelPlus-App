import { randomUUID } from 'crypto';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeValue(value: unknown): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 400 ? `${value.slice(0, 400)}...` : value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.split('\n').slice(0, 8).join('\n'),
    };
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, entryValue]) => [key, sanitizeValue(entryValue)])
    );
  }

  return String(value);
}

export function isBookingDebugEnabled(): boolean {
  const rawValue = process.env.BOOKING_DEBUG;
  if (!rawValue) return false;
  return ENABLED_VALUES.has(rawValue.trim().toLowerCase());
}

export function createBookingTraceId(prefix = 'booking'): string {
  return `${prefix}-${randomUUID().split('-')[0]}`;
}

export function bookingDebug(
  traceId: string,
  event: string,
  payload: Record<string, unknown> = {}
): void {
  if (!isBookingDebugEnabled()) return;

  console.info(
    '[booking-debug]',
    JSON.stringify({
      traceId,
      event,
      payload: sanitizeValue(payload),
      timestamp: new Date().toISOString(),
    })
  );
}

export function bookingDebugError(
  traceId: string,
  event: string,
  error: unknown,
  payload: Record<string, unknown> = {}
): void {
  console.error(
    '[booking-debug]',
    JSON.stringify({
      traceId,
      event,
      payload: sanitizeValue(payload),
      error: sanitizeValue(error),
      timestamp: new Date().toISOString(),
    })
  );
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) {
    return digits || phone;
  }

  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

export function withDebugId(message: string, traceId: string): string {
  return `${message} (debug-id: ${traceId})`;
}

export function getSupabaseDebugSnapshot() {
  return {
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseHost: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null,
  };
}
