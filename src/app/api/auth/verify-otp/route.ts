import { NextRequest, NextResponse } from 'next/server';
import { checkVerificationCode, toE164 } from '@/lib/twilio';
import { createServiceClient } from '@/lib/supabase/server';
import { createSession, setSessionCookie } from '@/lib/session';
import { findCustomerByPhone } from '@/lib/bikedesk';
import { normalizeVerificationCode, OTP_LENGTH } from '@/lib/auth';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(8),
  code: z.string().transform(normalizeVerificationCode).refine((value) => value.length === OTP_LENGTH, {
    message: `Koden skal være ${OTP_LENGTH} cifre`,
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, code } = schema.parse(body);
    const e164 = toE164(phone);

    const approved = await checkVerificationCode(e164, code);
    if (!approved) {
      return NextResponse.json({ error: 'Forkert kode. Prøv igen.' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Upsert user
    const { data: existing } = await supabase
      .from('users')
      .select('id, bikedesk_customer_id')
      .eq('phone', e164)
      .maybeSingle();

    let userId: string;
    let bikedeskCustomerId: number | null = existing?.bikedesk_customer_id ?? null;

    if (existing) {
      userId = existing.id;
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
    } else {
      // Look up customer in BikeDesk
      let bdCustomer = null;
      try {
        bdCustomer = await findCustomerByPhone(e164);
      } catch {
        // Non-fatal: BikeDesk may not have this user yet
      }

      bikedeskCustomerId = bdCustomer?.id ?? null;

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          phone: e164,
          bikedesk_customer_id: bikedeskCustomerId,
          last_login_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !newUser) throw new Error('Kunne ikke oprette bruger');
      userId = newUser.id;

      // Create empty profile
      await supabase.from('user_profiles').insert({
        id: userId,
        first_name: bdCustomer?.name?.split(' ')[0] ?? null,
        last_name: bdCustomer?.name?.split(' ').slice(1).join(' ') || null,
        email: bdCustomer?.email ?? null,
        address: bdCustomer?.address ?? null,
        city: bdCustomer?.city ?? null,
        zip: bdCustomer?.zipcode ?? null,
      });
    }

    const rawToken = await createSession(userId);
    await setSessionCookie(rawToken);

    // Fetch profile for response
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name')
      .eq('id', userId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      user: { id: userId, phone: e164, firstName: profile?.first_name ?? null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
