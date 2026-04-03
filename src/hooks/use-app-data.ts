'use client';

import useSWR, { preload } from 'swr';
import {
  BIKES_API_KEY,
  BOOKINGS_API_KEY,
  BOOKING_CONTEXT_API_KEY,
  HOME_API_KEY,
  SESSION_API_KEY,
} from '@/lib/api-keys';
import { fetchJson } from '@/lib/http';
import type {
  BikesPayload,
  BookingContextPayload,
  BookingsPayload,
  HomePayload,
  SessionPayload,
} from '@/types';

const swrOptions = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
  dedupingInterval: 15_000,
};

export function useSessionData() {
  return useSWR<SessionPayload>(SESSION_API_KEY, fetchJson, swrOptions);
}

export function useHomeData() {
  return useSWR<HomePayload>(HOME_API_KEY, fetchJson, swrOptions);
}

export function useGarageData() {
  return useSWR<BikesPayload>(BIKES_API_KEY, fetchJson, swrOptions);
}

export function useBookingsData() {
  return useSWR<BookingsPayload>(BOOKINGS_API_KEY, fetchJson, swrOptions);
}

export function useBookingContextData() {
  return useSWR<BookingContextPayload>(BOOKING_CONTEXT_API_KEY, fetchJson, swrOptions);
}

export function preloadMainTabData() {
  preload(SESSION_API_KEY, fetchJson);
  preload(HOME_API_KEY, fetchJson);
  preload(BIKES_API_KEY, fetchJson);
  preload(BOOKING_CONTEXT_API_KEY, fetchJson);
}
