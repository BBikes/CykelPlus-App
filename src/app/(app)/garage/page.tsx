import Link from 'next/link';
import { Plus, Bike as BikeIcon } from 'lucide-react';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { BikeCard } from '@/components/garage/bike-card';
import type { Bike } from '@/types';

export const metadata = { title: 'Garage — CykelPlus' };

async function getUserBikes(userId: string): Promise<Bike[]> {
  const supabase = await createServiceClient();

  // Get bikes with primary image
  const { data: bikes } = await supabase
    .from('bikes')
    .select('*, bike_images(storage_path, is_primary)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!bikes) return [];

  return bikes.map((bike) => {
    const primaryImage = (bike.bike_images as { storage_path: string; is_primary: boolean }[])?.find(
      (img) => img.is_primary
    );
    return {
      ...bike,
      bike_images: undefined,
      primary_image_url: primaryImage
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bike-images/${primaryImage.storage_path}`
        : null,
    } as Bike;
  });
}

export default async function GaragePage() {
  const session = await getSession();
  const bikes = await getUserBikes(session!.user.id);

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 page-bottom-padding safe-top">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Min garage</h1>
        <Link href="/garage/new">
          <Button size="sm" variant="primary">
            <Plus className="h-4 w-4" />
            Tilføj
          </Button>
        </Link>
      </div>

      {bikes.length === 0 ? (
        <EmptyState
          icon={<BikeIcon className="h-16 w-16" />}
          title="Ingen cykler endnu"
          description="Tilføj din første cykel for at komme i gang med bookinger og servicehistorik."
          action={{ label: 'Tilføj cykel', onClick: () => {} }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {bikes.map((bike) => (
            <BikeCard key={bike.id} bike={bike} />
          ))}
        </div>
      )}
    </div>
  );
}
