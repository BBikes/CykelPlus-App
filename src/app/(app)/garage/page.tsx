import Link from 'next/link';
import { Plus, Bike as BikeIcon } from 'lucide-react';
import { getSession } from '@/lib/session';
import { ensureBikeDeskSync } from '@/lib/bikedesk-sync';
import { listUserBikes } from '@/lib/app-bikes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BikeCard } from '@/components/garage/bike-card';

export const metadata = { title: 'Garage - CykelPlus' };

export default async function GaragePage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  await ensureBikeDeskSync(session, { requireBikes: true });
  const bikes = await listUserBikes(session.user.id);

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 page-bottom-padding safe-top">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Min garage</h1>
        <Link href="/garage/new">
          <Button size="sm" variant="primary">
            <Plus className="h-4 w-4" />
            Tilfoej
          </Button>
        </Link>
      </div>

      {bikes.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <BikeIcon className="h-14 w-14 text-gray-300" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ingen cykler endnu</h2>
            <p className="mt-1 text-sm text-gray-500">
              Tilfoej din foerste cykel for at faa bookinger, historik og tracker samlet her.
            </p>
          </div>
          <Link href="/garage/new">
            <Button variant="primary">Tilfoej cykel</Button>
          </Link>
        </Card>
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
