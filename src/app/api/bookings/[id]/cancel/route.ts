import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getUserBooking } from '@/lib/app-bookings';
import { getTicket, updateTicket } from '@/lib/bikedesk';
import { sendSms } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';

interface Props {
  params: Promise<{ id: string }>;
}

const CANCELLABLE_CUSTOMER_STATUSES = ['booking_created', 'awaiting_payment', 'booking_confirmed'];

export async function POST(_: Request, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  const { id } = await params;
  const booking = await getUserBooking(session.user, id);
  if (!booking) {
    return NextResponse.json({ error: 'Booking ikke fundet' }, { status: 404 });
  }

  const customerStatus = booking.customer_status ?? 'booking_created';
  if (!CANCELLABLE_CUSTOMER_STATUSES.includes(customerStatus)) {
    return NextResponse.json({ error: 'Denne booking kan ikke annulleres' }, { status: 400 });
  }

  if (booking.method === 'pickup' && booking.payment_status?.status === 'paid') {
    return NextResponse.json(
      { error: 'Kontakt B-Bikes for at annullere en allerede betalt afhentning' },
      { status: 400 }
    );
  }

  if (booking.bikedesk_ticket_id) {
    const ticket = await getTicket(booking.bikedesk_ticket_id);
    await updateTicket(ticket.id, {
      id: ticket.id,
      customerid: ticket.customerid,
      description: ticket.description,
      type: ticket.type,
      status: 'draft',
      startTime: ticket.startTime,
      pickup: ticket.pickup,
      assignee: typeof ticket.assignee === 'number' ? ticket.assignee : undefined,
      storeid: typeof ticket.storeid === 'number' ? ticket.storeid : undefined,
      tagids: Array.isArray(ticket.tagids) ? ticket.tagids : undefined,
    });
  }

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  await supabase
    .from('bookings')
    .update({ status: 'draft', updated_at: now })
    .eq('id', booking.id);

  if (booking.payment_status) {
    await supabase
      .from('booking_payment_status')
      .update({
        status: booking.payment_status.status === 'paid' ? 'refunded' : 'expired',
        updated_at: now,
      })
      .eq('booking_id', booking.id);
  }

  await supabase.from('booking_events').insert({
    booking_id: booking.id,
    event_type: 'cancelled',
    actor: 'user',
    payload: {},
  });

  try {
    await sendSms(
      session.user.phone,
      SMS_TEMPLATES.bookingCancelled({
        customer_name: session.profile?.first_name ?? '',
        task_no: booking.bikedesk_ticket_cardno ?? booking.id.slice(0, 8),
        store_title: 'B-Bikes',
        store_phone: '+4529837883',
      })
    );
  } catch (error) {
    console.warn('Cancellation SMS failed (non-fatal):', error);
  }

  return NextResponse.json({ success: true });
}
