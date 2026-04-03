import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeSharedBookingStatus } from '@/lib/bikedesk-status';
import { sendSms } from '@/lib/twilio';
import { SMS_TEMPLATES } from '@/lib/sms-templates';
import { formatDateToDanish } from '@/lib/booking/availability';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';

function normalizePaymentState(value: unknown): 'pending' | 'paid' | 'expired' | 'refunded' | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['pending', 'awaiting', 'open'].includes(normalized)) return 'pending';
  if (['paid', 'confirmed', 'completed'].includes(normalized)) return 'paid';
  if (['expired', 'timeout'].includes(normalized)) return 'expired';
  if (['refunded', 'cancelled'].includes(normalized)) return 'refunded';
  return null;
}

function getFirstName(customerName: string | null | undefined): string {
  return customerName?.trim().split(/\s+/)[0] ?? '';
}

export async function POST(req: NextRequest) {
  try {
    await ensureCykelPlusSchemaReady('app');

    const payload = await req.json();
    const ticketId = Number(payload?.ticket_id ?? payload?.id ?? 0);

    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticket_id' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, method, status, date, time, bikedesk_ticket_cardno, customer_data, bikedesk_ticket_id')
      .eq('bikedesk_ticket_id', ticketId)
      .maybeSingle();

    if (!booking) {
      return NextResponse.json({ ok: true });
    }

    const { data: currentPayment } = await supabase
      .from('booking_payment_status')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();

    const now = new Date().toISOString();
    const rawStatus =
      typeof payload?.status === 'string' ? normalizeSharedBookingStatus(payload.status) : null;
    const paymentState =
      normalizePaymentState(payload?.payment_status) ??
      normalizePaymentState(payload?.payment?.status) ??
      null;
    const nextCardNumber =
      typeof payload?.cardno === 'string'
        ? payload.cardno
        : typeof payload?.number === 'string'
          ? payload.number
          : typeof payload?.number === 'number'
            ? String(payload.number)
            : booking.bikedesk_ticket_cardno;

    if (
      rawStatus &&
      (rawStatus !== booking.status || nextCardNumber !== booking.bikedesk_ticket_cardno)
    ) {
      await supabase
        .from('bookings')
        .update({
          status: rawStatus,
          bikedesk_ticket_cardno: nextCardNumber,
          updated_at: now,
        })
        .eq('id', booking.id);
    }

    if (paymentState) {
      await supabase.from('booking_payment_status').upsert(
        {
          booking_id: booking.id,
          payment_ref: String(ticketId),
          status: paymentState,
          paid_at: paymentState === 'paid' ? now : currentPayment?.paid_at ?? null,
          expires_at: currentPayment?.expires_at ?? null,
          raw_webhook: payload,
          updated_at: now,
        },
        { onConflict: 'booking_id' }
      );
    }

    if (paymentState === 'paid' && currentPayment?.status !== 'paid') {
      await supabase.from('booking_events').insert({
        booking_id: booking.id,
        event_type: 'confirmed',
        actor: 'webhook',
        payload: { raw: payload },
      });

      try {
        const customerData =
          booking.customer_data && typeof booking.customer_data === 'object'
            ? (booking.customer_data as Record<string, unknown>)
            : null;
        const customerPhone =
          typeof customerData?.phone === 'string' ? customerData.phone : null;
        if (customerPhone) {
          await sendSms(
            customerPhone,
            SMS_TEMPLATES.bookingConfirmedAfterPayment({
              customer_name: getFirstName(
                typeof customerData?.name === 'string' ? customerData.name : null
              ),
              booking_date: formatDateToDanish(booking.date),
              booking_time: booking.time,
              task_no: booking.bikedesk_ticket_cardno ?? String(ticketId),
              store_title: 'B-Bikes',
            })
          );
        }
      } catch (error) {
        console.warn('Payment confirmation SMS failed (non-fatal):', error);
      }
    }

    if (paymentState === 'expired' && currentPayment?.status !== 'expired') {
      await supabase.from('booking_events').insert({
        booking_id: booking.id,
        event_type: 'payment_expired',
        actor: 'webhook',
        payload: { raw: payload },
      });
    }

    if (rawStatus === 'draft' && booking.status !== 'draft') {
      await supabase.from('booking_events').insert({
        booking_id: booking.id,
        event_type: 'cancelled',
        actor: 'webhook',
        payload: { raw: payload },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
