import { getSession } from '@/lib/session';
import { getConfiguredVehicleTypes } from '@/lib/booking-context';
import { PageHeader } from '@/components/layout/page-header';
import { BikeForm } from '@/components/garage/bike-form';

export default async function NewBikePage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const vehicleTypes = await getConfiguredVehicleTypes();

  return (
    <div className="flex flex-col">
      <PageHeader title="Tilfoej cykel" backHref="/garage" />
      <BikeForm
        vehicleTypes={vehicleTypes}
        submitUrl="/api/bikes"
        method="POST"
        title="Ny cykel i BikeDesk"
        description="Cyklen bliver oprettet i BikeDesk foerst og vises derefter i din garage."
      />
    </div>
  );
}
