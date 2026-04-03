import { getSession } from '@/lib/session';
import { ensureBikeDeskSync } from '@/lib/bikedesk-sync';
import { getCykelPlusBookingContext } from '@/lib/booking-context';
import { listUserBikes } from '@/lib/app-bikes';
import { PageHeader } from '@/components/layout/page-header';
import { BookingWizard } from '@/components/booking/booking-wizard';

interface Props {
  searchParams: Promise<{ bikeId?: string }>;
}

export default async function BookPage({ searchParams }: Props) {
  const { bikeId } = await searchParams;
  const session = await getSession();
  if (!session) {
    return null;
  }

  await ensureBikeDeskSync(session, { requireBikes: true });

  const [bikes, bookingContext] = await Promise.all([
    listUserBikes(session.user.id),
    getCykelPlusBookingContext(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title="Book service" backHref="/home" />
      <BookingWizard
        bikes={bikes}
        form={bookingContext.form}
        serviceCatalog={bookingContext.serviceCatalog}
        methodServiceTotals={bookingContext.methodServiceTotals}
        initialBikeId={bikeId ?? null}
      />
    </div>
  );
}
