import { createServiceClient } from '@/lib/supabase/server';
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
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('bikes')
    .select('*, bike_images(storage_path, is_primary)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((bike) => enrichBikeImage(bike as Record<string, unknown>));
}

export async function getUserBike(userId: string, bikeId: string): Promise<Bike | null> {
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

  return enrichBikeImage(data as Record<string, unknown>);
}
