import { createHash, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { createServiceClient } from './supabase/server';
import type { AppUser, UserProfile, AppSession } from '@/types';
import { COOKIE_NAME, SESSION_TOUCH_THROTTLE_MS, SESSION_TTL_DAYS } from './session-constants';

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createSession(userId: string): Promise<string> {
  const rawToken = randomUUID();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const supabase = await createServiceClient();
  const { error } = await supabase.from('user_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    last_used_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  return rawToken;
}

export async function setSessionCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  cookieStore.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

type SessionTouchStrategy = 'never' | 'throttled' | 'force';

interface GetSessionOptions {
  touch?: SessionTouchStrategy;
}

export async function getSession({
  touch = 'throttled',
}: GetSessionOptions = {}): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const supabase = await createServiceClient();

  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at, last_used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('user_sessions').delete().eq('token_hash', tokenHash);
    return null;
  }

  const lastUsedAt = session.last_used_at ? new Date(session.last_used_at).getTime() : 0;
  const shouldTouch =
    touch === 'force' ||
    (touch === 'throttled' && Date.now() - lastUsedAt >= SESSION_TOUCH_THROTTLE_MS);

  if (shouldTouch) {
    const newExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await supabase
      .from('user_sessions')
      .update({ last_used_at: new Date().toISOString(), expires_at: newExpiry.toISOString() })
      .eq('token_hash', tokenHash);
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .maybeSingle();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', session.user_id)
    .maybeSingle();

  return {
    user: user as AppUser,
    profile: profile as UserProfile | null,
  };
}

export async function deleteSession(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const supabase = await createServiceClient();
  await supabase.from('user_sessions').delete().eq('token_hash', tokenHash);
}
