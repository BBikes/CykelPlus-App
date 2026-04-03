import type { CalendarSettings } from '@/types';
import { getDanishHolidays } from './holidays';

export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateFromISO(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateToDanish(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function generateTimeSlots(
  startHour: number,
  endHour: number,
  durationMinutes: number
): string[] {
  const slots: string[] = [];
  let current = startHour * 60;
  const end = endHour * 60;

  while (current + durationMinutes <= end) {
    const hour = Math.floor(current / 60);
    const minute = current % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    current += durationMinutes;
  }

  return slots;
}

export function isDateBlocked(
  dateStr: string,
  settings: CalendarSettings,
  bookingCounts: Record<string, number> = {},
  method: 'workshop' | 'pickup' | 'onsite' = 'workshop'
): boolean {
  const date = parseDateFromISO(dateStr);
  const dayOfWeek = date.getDay();

  if (settings.block_weekdays.includes(dayOfWeek)) return true;

  if (settings.availability_mode === 'blacklist' && settings.blocked_dates.includes(dateStr)) {
    return true;
  }

  if (settings.availability_mode === 'whitelist' && !settings.whitelist_dates.includes(dateStr)) {
    return true;
  }

  if (settings.block_holidays) {
    const holidays = getDanishHolidays(date.getFullYear());
    const holidayName = holidays[dateStr];
    if (
      holidayName &&
      (settings.closed_holiday_names.length === 0 ||
        settings.closed_holiday_names.includes(holidayName))
    ) {
      return true;
    }
  }

  const count = bookingCounts[dateStr] ?? 0;
  const maxBookings =
    method === 'workshop'
      ? settings.max_bookings_workshop
      : method === 'pickup'
        ? settings.max_bookings_pickup
        : settings.max_bookings_onsite;

  return maxBookings > 0 && count >= maxBookings;
}
