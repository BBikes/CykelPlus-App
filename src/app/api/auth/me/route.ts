import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { ensureBikeDeskSync } from '@/lib/bikedesk-sync';
import { createCustomer, updateCustomer } from '@/lib/bikedesk';

const updateProfileSchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().optional().default(''),
  email: z.string().trim().email(),
  address: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  zip: z.string().trim().optional().default(''),
  sms_reminders: z.boolean(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  await ensureBikeDeskSync(session);
  const refreshedSession = await getSession();
  if (!refreshedSession) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  return NextResponse.json({ session: refreshedSession });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = updateProfileSchema.parse(body);
    const supabase = await createServiceClient();
    const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();

    let bikedeskCustomerId = session.user.bikedesk_customer_id;

    if (bikedeskCustomerId) {
      await updateCustomer(bikedeskCustomerId, {
        name: fullName,
        email: data.email,
        address: data.address,
        zipcode: data.zip,
        city: data.city,
      });
    } else {
      const createdCustomer = await createCustomer({
        name: fullName,
        phone: session.user.phone.replace(/^\+45/, ''),
        email: data.email,
        address: data.address,
        zipcode: data.zip,
        city: data.city,
      });
      bikedeskCustomerId = createdCustomer.id;
      await supabase
        .from('users')
        .update({
          bikedesk_customer_id: bikedeskCustomerId,
          last_bikedesk_sync_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);
    }

    await supabase.from('user_profiles').upsert(
      {
        id: session.user.id,
        first_name: data.first_name,
        last_name: data.last_name || null,
        email: data.email,
        address: data.address || null,
        city: data.city || null,
        zip: data.zip || null,
        sms_reminders: data.sms_reminders,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    const refreshedSession = await getSession();
    if (!refreshedSession) {
      return NextResponse.json({ error: 'Session kunne ikke opdateres' }, { status: 500 });
    }

    return NextResponse.json({ session: refreshedSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
