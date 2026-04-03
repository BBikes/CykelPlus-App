import { NextRequest, NextResponse } from 'next/server';
import { checkVerificationCode, toE164 } from '@/lib/twilio';
import { createServiceClient } from '@/lib/supabase/server';
import { createSession, setSessionCookie } from '@/lib/session';
import { syncUserFromBikedesk } from '@/lib/bikedesk-sync';
import { normalizeVerificationCode, OTP_LENGTH } from '@/lib/auth';
import type { AppUser } from '@/types';
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
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('phone', e164)
      .maybeSingle();

    let user: AppUser | null = existing as AppUser | null;

    if (user) {
      const { data: updatedUser } = await supabase
        .from('users')
        .update({ last_login_at: now })
        .eq('id', user.id)
        .select('*')
        .single();

      user = (updatedUser ?? user) as AppUser;
    } else {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          phone: e164,
          last_login_at: now,
        })
        .select('*')
        .single();

      if (error || !newUser) throw new Error('Kunne ikke oprette bruger');
      user = newUser as AppUser;
    }

    await syncUserFromBikedesk(user);

    const [{ data: syncedUser }, { data: profile }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('user_profiles').select('first_name').eq('id', user.id).maybeSingle(),
    ]);

    const rawToken = await createSession(user.id);
    await setSessionCookie(rawToken);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: syncedUser?.phone ?? e164,
        firstName: profile?.first_name ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
