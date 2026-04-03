import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession, clearSessionCookie } from '@/lib/session';
import { COOKIE_NAME } from '@/lib/session-constants';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(COOKIE_NAME)?.value;
    if (rawToken) {
      await deleteSession(rawToken);
    }
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
