import { createHash, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { createServiceClient } from './supabase/server';
import type { AppUser, UserProfile, AppSession } from '@/types';

const COOKIE_NAME = 'cykelplus_session';
const SESSION_TTL_DAYS = 90;

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

export async function getSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const supabase = await createServiceClient();

  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('user_sessions').delete().eq('token_hash', tokenHash);
    return null;
  }

  // Slide expiry
  const newExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await supabase
    .from('user_sessions')
    .update({ last_used_at: new Date().toISOString(), expires_at: newExpiry.toISOString() })
    .eq('token_hash', tokenHash);

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

export { COOKIE_NAME };
