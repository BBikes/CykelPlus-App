import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { hasMethodSpecificCapacity, normalizeBookingFormConfig } from '@/lib/booking/settings';
import {
  bookingDebug,
  bookingDebugError,
  createBookingTraceId,
  withDebugId,
} from '@/lib/booking-debug';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const querySchema = z.object({
  formId: z.string().regex(UUID_REGEX),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(['drop_off', 'pickup', 'onsite']),
});

export async function GET(req: NextRequest) {
  const traceId = createBookingTraceId('availability');

  try {
    const parsed = querySchema.parse({
      formId: req.nextUrl.searchParams.get('formId'),
      startDate: req.nextUrl.searchParams.get('startDate'),
      endDate: req.nextUrl.searchParams.get('endDate'),
      method: req.nextUrl.searchParams.get('method'),
    });

    bookingDebug(traceId, 'booking_availability.start', parsed);

    if (parsed.endDate < parsed.startDate) {
      bookingDebug(traceId, 'booking_availability.invalid_range', parsed);
      return NextResponse.json({ error: 'Ugyldigt datointerval' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: form, error: formError } = await supabase
      .from('booking_forms')
      .select('config')
      .eq('id', parsed.formId)
      .maybeSingle();

    if (formError) {
      bookingDebugError(traceId, 'booking_availability.form_query_failed', formError, parsed);
      return NextResponse.json(
        { error: withDebugId(formError.message, traceId), debugId: traceId },
        { status: 400 }
      );
    }

    if (!form) {
      bookingDebug(traceId, 'booking_availability.form_missing', { formId: parsed.formId });
      return NextResponse.json({ counts: {} });
    }

    const config = normalizeBookingFormConfig(form.config ?? {});
    const useFormSpecificCapacity = hasMethodSpecificCapacity(config, parsed.method);

    let query = supabase
      .from('bookings')
      .select('date')
      .eq('method', parsed.method)
      .neq('status', 'draft')
      .gte('date', parsed.startDate)
      .lte('date', parsed.endDate);

    if (useFormSpecificCapacity) {
      query = query.eq('form_id', parsed.formId);
    }

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      bookingDebugError(traceId, 'booking_availability.booking_query_failed', bookingsError, {
        ...parsed,
        useFormSpecificCapacity,
      });
      return NextResponse.json(
        { error: withDebugId(bookingsError.message, traceId), debugId: traceId },
        { status: 400 }
      );
    }

    const counts = (bookings ?? []).reduce<Record<string, number>>((acc, booking) => {
      if (!booking.date) {
        return acc;
      }

      acc[booking.date] = (acc[booking.date] ?? 0) + 1;
      return acc;
    }, {});

    bookingDebug(traceId, 'booking_availability.success', {
      ...parsed,
      useFormSpecificCapacity,
      bookedDates: Object.keys(counts).length,
      bookingRowCount: bookings?.length ?? 0,
    });

    return NextResponse.json({ counts });
  } catch (error) {
    bookingDebugError(traceId, 'booking_availability.failed', error, {
      searchParams: req.nextUrl.searchParams.toString(),
    });
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return NextResponse.json(
      { error: withDebugId(message, traceId), debugId: traceId },
      { status: 400 }
    );
  }
}
