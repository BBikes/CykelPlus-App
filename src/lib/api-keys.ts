export const SESSION_API_KEY = '/api/auth/me';
export const HOME_API_KEY = '/api/home';
export const BIKES_API_KEY = '/api/bikes';
export const BOOKINGS_API_KEY = '/api/bookings';
export const BOOKING_CONTEXT_API_KEY = '/api/booking/context';

export function bikeApiKey(bikeId: string): string {
  return `/api/bikes/${bikeId}`;
}

export function bookingApiKey(bookingId: string): string {
  return `/api/bookings/${bookingId}`;
}
