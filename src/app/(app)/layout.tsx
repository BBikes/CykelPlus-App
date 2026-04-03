import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AppShell } from '@/components/layout/app-shell';
import { toAppShellSession } from '@/lib/app-session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const initialSessionPayload = {
    session,
    viewer: toAppShellSession(session),
    sync: {
      lastSyncedAt: session.user.last_bikedesk_sync_at,
      syncRecommended: false,
      syncing: false,
    },
  };

  return (
    <AppShell initialSessionPayload={initialSessionPayload}>
      {children}
    </AppShell>
  );
}
