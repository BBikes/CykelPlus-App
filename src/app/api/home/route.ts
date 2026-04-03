import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getLatestActiveBooking } from '@/lib/app-bookings';
import { listUserBikes } from '@/lib/app-bikes';
import { getBikeDeskSyncMeta } from '@/lib/bikedesk-sync';
import { toAppShellSession } from '@/lib/app-session';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';
import type { Bike, ServiceReminder } from '@/types';

async function getHomePayload(user: { id: string; phone: string }) {
  const supabase = await createServiceClient();
  const [activeBooking, remindersRes, bikes] = await Promise.all([
    getLatestActiveBooking(user),
    supabase
      .from('service_reminders')
      .select('*, bike:bikes(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lte(
        'due_date',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )
      .order('due_date', { ascending: true })
      .limit(3),
    listUserBikes(user.id),
  ]);

  return {
    activeBooking,
    reminders: (remindersRes.data ?? []) as Array<ServiceReminder & { bike: Bike | null }>,
    bikes: bikes.slice(0, 3),
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    await ensureCykelPlusSchemaReady('app');

    const [payload, sync] = await Promise.all([
      getHomePayload(session.user),
      getBikeDeskSyncMeta(session, { requireBikes: true, requireBookings: true }),
    ]);

    return NextResponse.json({
      viewer: toAppShellSession(session),
      activeBooking: payload.activeBooking,
      reminders: payload.reminders,
      bikes: payload.bikes,
      sync,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
