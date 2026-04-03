import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkVerificationCode, toE164 } from '@/lib/twilio';
import { createServiceClient } from '@/lib/supabase/server';
import { createSession, setSessionCookie } from '@/lib/session';
import { syncUserFromBikedesk } from '@/lib/bikedesk-sync';
import { normalizeVerificationCode, OTP_LENGTH } from '@/lib/auth';
import {
  bookingDebug,
  bookingDebugError,
  createBookingTraceId,
  getSupabaseDebugSnapshot,
  maskPhone,
  withDebugId,
} from '@/lib/booking-debug';
import { ensureCykelPlusSchemaReady } from '@/lib/cykelplus-schema';
import type { AppUser } from '@/types';

const schema = z.object({
  phone: z.string().min(8),
  code: z.string().transform(normalizeVerificationCode).refine((value) => value.length === OTP_LENGTH, {
    message: `Koden skal være ${OTP_LENGTH} cifre`,
  }),
});

export async function POST(req: NextRequest) {
  const traceId = createBookingTraceId('auth');

  try {
    const body = await req.json();
    const { phone, code } = schema.parse(body);
    const e164 = toE164(phone);

    bookingDebug(traceId, 'auth_verify.start', {
      phone: maskPhone(e164),
      codeLength: code.length,
      ...getSupabaseDebugSnapshot(),
    });

    const approved = await checkVerificationCode(e164, code);
    if (!approved) {
      bookingDebug(traceId, 'auth_verify.code_rejected', {
        phone: maskPhone(e164),
      });

      return NextResponse.json(
        {
          error: withDebugId('Forkert kode. Prøv igen.', traceId),
          debugId: traceId,
        },
        { status: 400 }
      );
    }

    await ensureCykelPlusSchemaReady('auth', {
      traceId,
      source: 'auth_verify',
    });

    const supabase = await createServiceClient();
    const now = new Date().toISOString();

    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', e164)
      .maybeSingle();

    if (existingError) {
      throw new Error(`users-opslag fejlede: ${existingError.message}`);
    }

    let user: AppUser | null = existing as AppUser | null;

    if (user) {
      const { data: updatedUser, error: updatedUserError } = await supabase
        .from('users')
        .update({ last_login_at: now })
        .eq('id', user.id)
        .select('*')
        .single();

      if (updatedUserError) {
        throw new Error(`Kunne ikke opdatere bruger: ${updatedUserError.message}`);
      }

      if (!updatedUser) {
        throw new Error('Kunne ikke opdatere bruger');
      }

      user = updatedUser as AppUser;

      bookingDebug(traceId, 'auth_verify.user_updated', {
        userId: user.id,
        phone: maskPhone(user.phone),
      });
    } else {
      const { data: newUser, error: newUserError } = await supabase
        .from('users')
        .insert({
          phone: e164,
          last_login_at: now,
        })
        .select('*')
        .single();

      if (newUserError) {
        throw new Error(`Kunne ikke oprette bruger: ${newUserError.message}`);
      }

      if (!newUser) {
        throw new Error('Kunne ikke oprette bruger');
      }

      user = newUser as AppUser;

      bookingDebug(traceId, 'auth_verify.user_created', {
        userId: user.id,
        phone: maskPhone(user.phone),
      });
    }

    await syncUserFromBikedesk(user);

    const [{ data: syncedUser, error: syncedUserError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).single(),
        supabase.from('user_profiles').select('first_name').eq('id', user.id).maybeSingle(),
      ]);

    if (syncedUserError) {
      throw new Error(`Kunne ikke hente bruger efter login: ${syncedUserError.message}`);
    }

    if (profileError) {
      throw new Error(`Kunne ikke hente profil efter login: ${profileError.message}`);
    }

    const rawToken = await createSession(user.id);
    await setSessionCookie(rawToken);

    bookingDebug(traceId, 'auth_verify.success', {
      userId: user.id,
      phone: maskPhone(syncedUser?.phone ?? e164),
      hasProfile: Boolean(profile),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: syncedUser?.phone ?? e164,
        firstName: profile?.first_name ?? null,
      },
    });
  } catch (error) {
    bookingDebugError(traceId, 'auth_verify.failed', error, {
      ...getSupabaseDebugSnapshot(),
    });

    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? 'Ugyldig anmodning'
        : error instanceof Error
          ? error.message
          : 'Ukendt fejl';
    const status = error instanceof z.ZodError ? 400 : 500;

    return NextResponse.json(
      {
        error: withDebugId(message, traceId),
        debugId: traceId,
      },
      { status }
    );
  }
}
