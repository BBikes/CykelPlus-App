import { createServiceClient } from '@/lib/supabase/server';

let bookingExtensionsSupportPromise: Promise<boolean> | null = null;

export async function supportsBookingExtensions(): Promise<boolean> {
  if (!bookingExtensionsSupportPromise) {
    bookingExtensionsSupportPromise = (async () => {
      const supabase = await createServiceClient();
      const { error } = await supabase
        .from('bookings')
        .select('user_id,bike_id,payment_link_url,payment_expires_at')
        .limit(1);

      return !error;
    })();
  }

  return bookingExtensionsSupportPromise;
}
