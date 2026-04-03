import { notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getUserBike } from '@/lib/app-bikes';
import { getConfiguredVehicleTypes } from '@/lib/booking-context';
import { PageHeader } from '@/components/layout/page-header';
import { BikeForm } from '@/components/garage/bike-form';

interface Props {
  params: Promise<{ bikeId: string }>;
}

export default async function EditBikePage({ params }: Props) {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const { bikeId } = await params;
  const [bike, vehicleTypes] = await Promise.all([
    getUserBike(session.user.id, bikeId),
    getConfiguredVehicleTypes(),
  ]);

  if (!bike) {
    notFound();
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Rediger cykel" backHref={`/garage/${bike.id}`} />
      <BikeForm
        bike={bike}
        vehicleTypes={vehicleTypes}
        submitUrl={`/api/bikes/${bike.id}`}
        method="PUT"
        title="Opdater cykel"
        description="Aendringerne skrives tilbage til BikeDesk og bruges derefter i appen."
      />
    </div>
  );
}
