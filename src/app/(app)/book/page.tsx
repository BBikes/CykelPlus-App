import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/layout/page-header';
import { BookingWizard } from '@/components/booking/booking-wizard';
import type { Bike } from '@/types';

interface Props {
  searchParams: Promise<{ bikeId?: string }>;
}

async function getUserBikes(userId: string): Promise<Bike[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('bikes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Bike[];
}

export default async function BookPage({ searchParams }: Props) {
  const { bikeId } = await searchParams;
  const session = await getSession();
  const bikes = await getUserBikes(session!.user.id);

  return (
    <div className="flex flex-col">
      <PageHeader title="Book service" backHref="/home" />
      <BookingWizard bikes={bikes} initialBikeId={bikeId ?? null} />
    </div>
  );
}
