import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { ensureBikeDeskSync, getBikeDeskSyncMeta } from '@/lib/bikedesk-sync';
import { toAppShellSession } from '@/lib/app-session';

const syncSchema = z.object({
  requireBikes: z.boolean().optional(),
  requireBookings: z.boolean().optional(),
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession({ touch: 'force' });
    if (!session) {
      return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const options = syncSchema.parse(body);

    await ensureBikeDeskSync(session, options);

    const refreshedSession = await getSession({ touch: 'never' });
    if (!refreshedSession) {
      return NextResponse.json({ error: 'Session kunne ikke opdateres' }, { status: 401 });
    }

    const sync = await getBikeDeskSyncMeta(refreshedSession, options);
    return NextResponse.json({
      session: refreshedSession,
      viewer: toAppShellSession(refreshedSession),
      sync,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
