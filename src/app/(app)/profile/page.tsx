import { getSession } from '@/lib/session';
import { ensureBikeDeskSync } from '@/lib/bikedesk-sync';
import { ProfileForm } from '@/components/profile/profile-form';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  await ensureBikeDeskSync(session);
  const refreshedSession = await getSession();

  if (!refreshedSession) {
    return null;
  }

  return <ProfileForm session={refreshedSession} />;
}
