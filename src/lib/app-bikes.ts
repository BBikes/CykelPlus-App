import { createServiceClient } from '@/lib/supabase/server';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';
import type { Bike } from '@/types';

function enrichBikeImage(bike: Record<string, unknown>): Bike {
  const images = Array.isArray(bike.bike_images)
    ? (bike.bike_images as Array<{ storage_path: string; is_primary: boolean }>)
    : [];
  const primaryImage = images.find((image) => image.is_primary);

  return {
    ...(bike as unknown as Bike),
    primary_image_url: primaryImage
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bike-images/${primaryImage.storage_path}`
      : null,
  };
}

export async function listUserBikes(userId: string): Promise<Bike[]> {
  await ensureCykelPlusSchemaReady('auth');

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('bikes')
    .select('*, bike_images(storage_path, is_primary)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const bikes = (data ?? []).map((bike) => enrichBikeImage(bike as Record<string, unknown>));
  if (bikes.length === 0) {
    return [];
  }

  const { data: trackerRows } = await supabase
    .from('tracker_addons')
    .select('bike_id, active, status')
    .eq('user_id', userId)
    .in(
      'bike_id',
      bikes.map((bike) => bike.id)
    );

  const trackerMap = new Map(
    (trackerRows ?? []).map((tracker) => [tracker.bike_id as string, tracker])
  );

  return bikes.map((bike) => {
    const tracker = trackerMap.get(bike.id);
    return {
      ...bike,
      tracker_active: tracker?.active ?? false,
      tracker_status: (tracker?.status as Bike['tracker_status']) ?? null,
    };
  });
}

export async function getUserBike(userId: string, bikeId: string): Promise<Bike | null> {
  await ensureCykelPlusSchemaReady('auth');

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('bikes')
    .select('*, bike_images(storage_path, is_primary)')
    .eq('id', bikeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const bike = enrichBikeImage(data as Record<string, unknown>);
  const { data: trackerRow } = await supabase
    .from('tracker_addons')
    .select('active, status')
    .eq('user_id', userId)
    .eq('bike_id', bikeId)
    .maybeSingle();

  return {
    ...bike,
    tracker_active: trackerRow?.active ?? false,
    tracker_status: (trackerRow?.status as Bike['tracker_status']) ?? null,
  };
}
